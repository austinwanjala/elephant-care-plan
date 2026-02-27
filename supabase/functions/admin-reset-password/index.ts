// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
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
      console.error("[admin-reset-password] Unauthorized token", authUserError);
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
      console.error("[admin-reset-password] Failed to fetch caller role", callerRoleError);
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

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and new password are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 1. Find user in our public tables
    const [{ data: member }, { data: staff }] = await Promise.all([
      supabaseAdmin.from("members").select("user_id, full_name, phone, email").eq("email", email).maybeSingle(),
      supabaseAdmin.from("staff").select("user_id, full_name, phone, email").eq("email", email).maybeSingle(),
    ]);

    const user = member || staff;

    if (!user) {
      return new Response(JSON.stringify({ error: "This email is not registered in our system." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 2. Admins cannot reset passwords for admin/super_admin accounts
    if (!isSuperAdmin) {
      const { data: targetRoles, error: targetRolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.user_id);

      if (targetRolesError) {
        console.error("[admin-reset-password] Failed to fetch target roles", targetRolesError);
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

    // 3. Update password in Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.user_id, {
      password,
    });

    if (updateError) {
      console.error("[admin-reset-password] Password update failed", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 4. Audit log
    await supabaseAdmin.from("system_logs").insert({
      action: "ADMIN_PASSWORD_RESET",
      user_id: callerId,
      details: {
        target_user_id: user.user_id,
        target_email: email,
        performed_by: callerId,
        caller_role: callerRole,
      },
    });

    // 5. Optional SMS notification
    if (user.phone) {
      const { error: smsError } = await supabaseAdmin.functions.invoke("send-sms", {
        body: {
          type: "password_reset",
          phone: user.phone,
          email: user.email,
          data: {
            name: user.full_name,
            password,
          },
        },
      });

      if (smsError) {
        console.error("[admin-reset-password] Failed to send SMS notification", smsError);
      }
    }

    return new Response(JSON.stringify({ message: "Password updated successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[admin-reset-password] Fatal error", { message: error?.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});