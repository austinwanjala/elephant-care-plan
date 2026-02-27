import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Manual authentication handling
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.getUser(token);
    if (authUserError || !authUser?.user) {
      console.error("[admin-delete-user] Unauthorized token", authUserError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const callerId = authUser.user.id;

    const { data: callerRoleRow, error: callerRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .limit(1)
      .maybeSingle();

    if (callerRoleError) {
      console.error("[admin-delete-user] Failed to fetch caller role", callerRoleError);
      return new Response(JSON.stringify({ error: "Unable to verify permissions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const callerRole = (callerRoleRow?.role as string | null) ?? null;
    const isSuperAdmin = callerRole === "super_admin";
    const isAdmin = callerRole === "admin";

    if (!isSuperAdmin && !isAdmin) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Admins cannot delete admin/super_admin accounts
    if (!isSuperAdmin) {
      const { data: targetRoles, error: targetRolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (targetRolesError) {
        console.error("[admin-delete-user] Failed to fetch target roles", targetRolesError);
        return new Response(JSON.stringify({ error: "Unable to verify target user" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      const roles = (targetRoles ?? []).map((r: any) => r.role);
      if (roles.includes("admin") || roles.includes("super_admin")) {
        return new Response(JSON.stringify({ error: "Permission denied" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
    }

    console.log("[admin-delete-user] Deleting user", { userId, callerId, callerRole });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("[admin-delete-user] Delete failed", { message: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ message: "User deleted successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[admin-delete-user] Fatal error", { message: error?.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});