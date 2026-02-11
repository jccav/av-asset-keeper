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
    const borrower_name = typeof body.borrower_name === "string" ? body.borrower_name.trim().slice(0, 100) : "";
    const team_name = typeof body.team_name === "string" ? body.team_name.trim().slice(0, 100) : "";
    const expected_return = typeof body.expected_return === "string" ? body.expected_return.trim() : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const condition_counts = body.condition_counts;
    const force_merge = !!body.force_merge;

    // Validate required fields
    if (!equipment_id || !borrower_name || !team_name || !pin) {
      return new Response(JSON.stringify({ error: "Missing required fields (equipment_id, borrower_name, team_name, 4-digit pin)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
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

    // Validate expected_return date
    if (expected_return) {
      const d = new Date(expected_return);
      if (isNaN(d.getTime()) || d < new Date() || d > new Date(Date.now() + 365 * 86400000)) {
        return new Response(JSON.stringify({ error: "Expected return date must be a valid future date within 1 year" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate condition_counts
    if (!condition_counts || typeof condition_counts !== "object" || Array.isArray(condition_counts)) {
      return new Response(JSON.stringify({ error: "condition_counts must be an object" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validConditions = ["excellent", "good", "fair", "damaged", "bad"];
    for (const [key, val] of Object.entries(condition_counts)) {
      if (!validConditions.includes(key) || typeof val !== "number" || !Number.isInteger(val) || val < 0) {
        return new Response(JSON.stringify({ error: `Invalid condition_counts: key must be one of ${validConditions.join(",")} with non-negative integer values` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const checkoutTotal = Object.values(condition_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    if (checkoutTotal < 1) {
      return new Response(JSON.stringify({ error: "Must check out at least 1 item" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current equipment state
    const { data: current, error: fetchErr } = await serviceClient
      .from("equipment")
      .select("quantity_available, condition_counts, total_quantity")
      .eq("id", equipment_id)
      .single();

    if (fetchErr || !current) {
      return new Response(JSON.stringify({ error: "Equipment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (current.quantity_available < checkoutTotal) {
      return new Response(JSON.stringify({ error: `Only ${current.quantity_available} available. You requested ${checkoutTotal}.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate condition counts don't exceed available per condition
    const eqCounts = (current.condition_counts ?? {}) as Record<string, number>;
    for (const [cond, qty] of Object.entries(condition_counts as Record<string, number>)) {
      if (qty > 0 && qty > (eqCounts[cond] ?? 0)) {
        return new Response(JSON.stringify({ error: `Only ${eqCounts[cond] ?? 0} available in ${cond} condition` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for existing matching checkout to merge
    if (!force_merge) {
      const { data: existing } = await serviceClient
        .from("checkout_log")
        .select("id, quantity, checkout_condition_counts")
        .eq("equipment_id", equipment_id)
        .eq("borrower_name", borrower_name)
        .eq("pin", pin)
        .is("return_date", null)
        .order("checkout_date", { ascending: false })
        .limit(1);

      const match = existing?.find((l: any) => l.quantity > 0);
      if (match) {
        return new Response(JSON.stringify({ merge_prompt: true, existing: match }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (force_merge) {
      // Find existing checkout to merge into
      const { data: existing } = await serviceClient
        .from("checkout_log")
        .select("id, quantity, checkout_condition_counts, notes")
        .eq("equipment_id", equipment_id)
        .eq("borrower_name", borrower_name)
        .eq("pin", pin)
        .is("return_date", null)
        .order("checkout_date", { ascending: false })
        .limit(1);

      const mergeTarget = existing?.find((l: any) => l.quantity > 0);
      if (!mergeTarget) {
        return new Response(JSON.stringify({ error: "No existing checkout found to merge" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingCounts = (mergeTarget.checkout_condition_counts ?? {}) as Record<string, number>;
      const mergedCounts: Record<string, number> = { ...existingCounts };
      for (const [cond, qty] of Object.entries(condition_counts as Record<string, number>)) {
        if (qty > 0) mergedCounts[cond] = (mergedCounts[cond] ?? 0) + qty;
      }

      const { error: mergeErr } = await serviceClient
        .from("checkout_log")
        .update({
          quantity: mergeTarget.quantity + checkoutTotal,
          checkout_condition_counts: mergedCounts,
          notes: notes ? (mergeTarget.notes ? `${mergeTarget.notes}; ${notes}` : notes) : mergeTarget.notes,
        })
        .eq("id", mergeTarget.id);

      if (mergeErr) {
        return new Response(JSON.stringify({ error: mergeErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // New checkout record
      const { error: logError } = await serviceClient.from("checkout_log").insert({
        equipment_id,
        borrower_name,
        team_name: team_name || null,
        expected_return: expected_return || null,
        notes: notes || null,
        pin,
        quantity: checkoutTotal,
        checkout_condition_counts: condition_counts,
      });

      if (logError) {
        return new Response(JSON.stringify({ error: logError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update equipment counts
    const counts = { ...eqCounts };
    for (const [cond, qty] of Object.entries(condition_counts as Record<string, number>)) {
      if (qty > 0) counts[cond] = Math.max(0, (counts[cond] ?? 0) - qty);
    }
    const newAvailable = current.quantity_available - checkoutTotal;
    const mainCondition = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a), ["good", 0])[0];

    const { error: eqError } = await serviceClient
      .from("equipment")
      .update({
        quantity_available: newAvailable,
        is_available: newAvailable > 0,
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
