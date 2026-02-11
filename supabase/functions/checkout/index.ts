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
      borrower_name,
      team_name,
      expected_return,
      notes,
      pin,
      condition_counts,
      force_merge,
    } = await req.json();

    // Validate required fields
    if (!equipment_id || !borrower_name || !team_name || !pin || pin.length !== 4) {
      return new Response(JSON.stringify({ error: "Missing required fields (equipment_id, borrower_name, team_name, 4-digit pin)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!condition_counts || typeof condition_counts !== "object") {
      return new Response(JSON.stringify({ error: "condition_counts required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutTotal = Object.values(condition_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    if (checkoutTotal < 1) {
      return new Response(JSON.stringify({ error: "Must check out at least 1 item" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate pin is numeric
    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
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
