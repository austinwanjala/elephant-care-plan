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

    const body = await req.json().catch(() => ({}));
    const userId = (body.userId as string | undefined) ?? undefined;
    const email = (body.email as string | undefined) ?? undefined;
    const password = (body.password as string | undefined) ?? undefined;

    if (!password) {
      return new Response(JSON.stringify({ error: "New password is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "userId or email is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Identify the target auth user ID.
    // If userId is provided, use it directly (don't depend on public profile tables).
    let targetAuthUserId = userId;

    if (!targetAuthUserId && email) {
      const { data: authByEmail, error: authByEmailError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1,
        page: 1,
        email,
      });

      if (authByEmailError) {
        console.error("[admin-reset-password] Failed to lookup auth user by email", authByEmailError);
        return new Response(JSON.stringify({ error: "Unable to lookup user" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const found = authByEmail?.users?.[0];
      if (!found) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      targetAuthUserId = found.id;
    }

    if (!targetAuthUserId) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Admins cannot reset passwords for admin/super_admin accounts
    if (!isSuperAdmin) {
      const { data: targetRoles, error: targetRolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetAuthUserId);

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

    // Update password in Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetAuthUserId, {
      password,
    });

    if (updateError) {
      console.error("[admin-reset-password] Password update failed", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Try to find contact info for notifications/audit (optional)
    const [{ data: member }, { data: staff }, { data: marketer }, { data: director }] = await Promise.all([
      supabaseAdmin.from("members").select("user_id, full_name, phone, email").eq("user_id", targetAuthUserId).maybeSingle(),
      supabaseAdmin.from("staff").select("user_id, full_name, phone, email").eq("user_id", targetAuthUserId).maybeSingle(),
      supabaseAdmin.from("marketers").select("user_id, full_name, phone, email").eq("user_id", targetAuthUserId).maybeSingle(),
      supabaseAdmin.from("branch_directors").select("user_id, full_name, phone, email").eq("user_id", targetAuthUserId).maybeSingle(),
    ]);

    const profile = member || staff || marketer || director || null;

    // Audit log
    await supabaseAdmin.from("system_logs").insert({
      action: "ADMIN_PASSWORD_RESET",
      user_id: callerId,
      details: {
        target_user_id: targetAuthUserId,
        target_email: profile?.email ?? email ?? null,
        performed_by: callerId,
        caller_role: callerRole,
      },
    });

    // Optional SMS notification
    if (profile?.phone) {
      const { error: smsError } = await supabaseAdmin.functions.invoke("send-sms", {
        body: {
          type: "password_reset",
          phone: profile.phone,
          email: profile.email,
          data: {
            name: profile.full_name,
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
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});