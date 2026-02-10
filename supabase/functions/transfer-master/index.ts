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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get caller from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller is master admin
    const { data: callerRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "master_admin")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Only master admin can transfer role" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { new_master_id } = await req.json();
    if (!new_master_id || new_master_id === caller.id) {
      return new Response(JSON.stringify({ error: "Invalid target user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify target is an existing admin
    const { data: targetRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", new_master_id)
      .maybeSingle();

    if (!targetRole) {
      return new Response(JSON.stringify({ error: "Target user is not an admin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Transfer: update target to master_admin, demote caller to admin
    await serviceClient.from("user_roles").update({ role: "master_admin" }).eq("user_id", new_master_id);
    await serviceClient.from("user_roles").update({ role: "admin" }).eq("user_id", caller.id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
