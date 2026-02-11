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

    const {
      equipment_id,
      pin,
      condition_counts,
      return_notes,
      returned_by,
    } = await req.json();

    if (!equipment_id || !pin) {
      return new Response(JSON.stringify({ error: "equipment_id and pin required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!condition_counts || typeof condition_counts !== "object") {
      return new Response(JSON.stringify({ error: "condition_counts required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Update checkout log
    const { error: logError } = await serviceClient
      .from("checkout_log")
      .update({
        quantity_returned: newQtyReturned,
        ...(fullyReturned ? { return_date: new Date().toISOString() } : {}),
        condition_on_return: mainReturnCondition,
        return_notes: return_notes || null,
        returned_by: returned_by || log.borrower_name,
      })
      .eq("id", log.id);

    if (logError) {
      return new Response(JSON.stringify({ error: logError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update equipment
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

    const { error: eqError } = await serviceClient
      .from("equipment")
      .update({
        quantity_available: restored,
        is_available: true,
        condition: mainCondition,
        condition_counts: counts,
      })
      .eq("id", equipment_id);

    if (eqError) {
      return new Response(JSON.stringify({ error: eqError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
