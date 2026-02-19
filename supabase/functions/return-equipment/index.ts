import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const equipment_id = typeof body.equipment_id === "string" ? body.equipment_id.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const condition_counts = body.condition_counts;
    const return_notes = typeof body.return_notes === "string" ? body.return_notes.trim().slice(0, 500) : null;
    const returned_by = typeof body.returned_by === "string" ? body.returned_by.trim().slice(0, 100) : null;
    const av_member = typeof body.av_member === "string" ? body.av_member.trim().slice(0, 100) : null;

    if (!equipment_id || !pin) {
      return new Response(JSON.stringify({ error: "equipment_id and pin required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(equipment_id)) {
      return new Response(JSON.stringify({ error: "Invalid equipment_id format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!condition_counts || typeof condition_counts !== "object" || Array.isArray(condition_counts)) {
      return new Response(JSON.stringify({ error: "condition_counts must be an object" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validConditions = ["excellent", "good", "fair", "damaged", "bad"];
    for (const [key, val] of Object.entries(condition_counts)) {
      if (!validConditions.includes(key) || typeof val !== "number" || !Number.isInteger(val) || val < 0) {
        return new Response(JSON.stringify({ error: `Invalid condition_counts entry` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const totalReturning = Object.values(condition_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    if (totalReturning < 1) {
      return new Response(JSON.stringify({ error: "Must return at least 1 item" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active checkout
    const { data: logs, error: findError } = await serviceClient
      .from("checkout_log")
      .select("id, borrower_name, pin, quantity, quantity_returned")
      .eq("equipment_id", equipment_id)
      .is("return_date", null)
      .order("checkout_date", { ascending: false });

    if (findError) {
      return new Response(JSON.stringify({ error: findError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const log = logs?.find((l: any) => (l.quantity - (l.quantity_returned ?? 0)) > 0);
    if (!log) {
      return new Response(JSON.stringify({ error: "No active checkout found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PIN
    if (pin.trim() !== log.pin) {
      return new Response(JSON.stringify({ error: "Incorrect PIN. Please enter the 4-digit PIN used during checkout." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remainingBefore = log.quantity - (log.quantity_returned ?? 0);
    if (totalReturning > remainingBefore) {
      return new Response(JSON.stringify({ error: `You can only return up to ${remainingBefore} items` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newQtyReturned = (log.quantity_returned ?? 0) + totalReturning;
    const fullyReturned = newQtyReturned >= log.quantity;
    const mainReturnCondition = Object.entries(condition_counts as Record<string, number>).reduce(
      (a: [string, number], b: [string, number]) => (b[1] > a[1] ? b : a),
      ["good", 0]
    )[0];

    // Fetch equipment for computing new state
    const { data: eq } = await serviceClient
      .from("equipment")
      .select("quantity_available, total_quantity, condition_counts")
      .eq("id", equipment_id)
      .single();

    const restored = Math.min(
      (eq?.quantity_available ?? 0) + totalReturning,
      eq?.total_quantity ?? totalReturning
    );
    const counts = ((eq?.condition_counts ?? {}) as Record<string, number>);
    for (const [cond, qty] of Object.entries(condition_counts as Record<string, number>)) {
      if (qty > 0) counts[cond] = (counts[cond] ?? 0) + qty;
    }
    const mainCondition = Object.entries(counts).reduce(
      (a: [string, number], b: [string, number]) => (b[1] > a[1] ? b : a),
      ["good", 0]
    )[0];

    // Atomic return via RPC
    const { error: returnError } = await serviceClient.rpc("perform_return", {
      p_checkout_id: log.id,
      p_new_qty_returned: newQtyReturned,
      p_fully_returned: fullyReturned,
      p_condition_on_return: mainReturnCondition,
      p_return_notes: return_notes || null,
      p_returned_by: returned_by || log.borrower_name,
      p_equipment_id: equipment_id,
      p_new_eq_available: restored,
      p_new_eq_condition: mainCondition,
      p_new_eq_condition_counts: counts,
    });

    if (returnError) {
      return new Response(JSON.stringify({ error: "Failed to process return" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
