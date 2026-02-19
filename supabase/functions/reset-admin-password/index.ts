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

    // Verify caller identity
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller is master_admin
    const { data: callerRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "master_admin")
      .maybeSingle();

    if (!callerRole) {
      // Non-master admins can only reset their own password
      const { data: adminRole } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const isMaster = !!callerRole;

    const body = await req.json();
    const targetUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return new Response(JSON.stringify({ error: "Invalid user ID format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!newPassword) {
      return new Response(JSON.stringify({ error: "New password is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return new Response(JSON.stringify({ error: "Password must be between 8 and 128 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    {
      const hasUpper = /[A-Z]/.test(newPassword);
      const hasLower = /[a-z]/.test(newPassword);
      const hasNumberOrSymbol = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword);
      if (!hasUpper || !hasLower || !hasNumberOrSymbol) {
        return new Response(JSON.stringify({ error: "Password must contain at least one uppercase letter, one lowercase letter, and one number or symbol" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Non-master admins can only reset their own password
    if (!isMaster && targetUserId !== caller.id) {
      return new Response(JSON.stringify({ error: "You can only reset your own password" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify target is an admin (not arbitrary users)
    const { data: targetRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetRole) {
      return new Response(JSON.stringify({ error: "Target user is not an admin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update the user's password
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Password reset error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to reset password" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
