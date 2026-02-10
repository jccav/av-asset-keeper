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
      return new Response(JSON.stringify({ error: "Only master admin can remove admins" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id } = await req.json();
    if (!user_id || user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Invalid user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Remove role
    const { error } = await serviceClient.from("user_roles").delete().eq("user_id", user_id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
