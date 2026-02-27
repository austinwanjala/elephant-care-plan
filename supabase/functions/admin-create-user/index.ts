import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole =
  | "member"
  | "receptionist"
  | "doctor"
  | "branch_director"
  | "marketer"
  | "admin"
  | "super_admin"
  | "finance"
  | "auditor";

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

    // Manual authentication handling (verify_jwt is false in edge runtime)
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
      console.error("[admin-create-user] Unauthorized token", authUserError);
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
      console.error("[admin-create-user] Failed to fetch caller role", callerRoleError);
      return new Response(JSON.stringify({ error: "Unable to verify permissions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const callerRole = (callerRoleRow?.role as string | null) ?? null;

    const { email, password, metadata } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const requestedRole = (metadata?.role as AppRole | undefined) ?? "member";

    // Permission matrix
    const isSuperAdmin = callerRole === "super_admin";
    const isAdmin = callerRole === "admin";
    const isDirector = callerRole === "branch_director";
    const isReceptionist = callerRole === "receptionist";
    const isMarketer = callerRole === "marketer";

    const allowCreateMember = isSuperAdmin || isAdmin || isDirector || isReceptionist || isMarketer;

    const allowCreateStaffByDirector = isDirector && ["receptionist", "doctor", "marketer"].includes(requestedRole);

    const allowCreateStaffByAdmin =
      (isAdmin || isSuperAdmin) &&
      [
        "receptionist",
        "doctor",
        "branch_director",
        "marketer",
        "finance",
        "auditor",
        "member",
      ].includes(requestedRole);

    const allowCreateAdminLevel = isSuperAdmin && ["admin", "super_admin"].includes(requestedRole);

    const isAllowed =
      (requestedRole === "member" && allowCreateMember) ||
      allowCreateStaffByDirector ||
      allowCreateStaffByAdmin ||
      allowCreateAdminLevel;

    if (!isAllowed) {
      console.warn("[admin-create-user] Permission denied", { callerRole, requestedRole });
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Directors can only create users for their own branch (when applicable)
    if (isDirector) {
      const { data: directorStaff, error: directorStaffError } = await supabaseAdmin
        .from("staff")
        .select("branch_id")
        .eq("user_id", callerId)
        .maybeSingle();

      if (directorStaffError) {
        console.error("[admin-create-user] Failed to fetch director branch", directorStaffError);
        return new Response(JSON.stringify({ error: "Unable to verify branch" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      const directorBranchId = directorStaff?.branch_id ?? null;

      // Force/override branch_id when director is creating staff
      if (["receptionist", "doctor", "branch_director"].includes(requestedRole)) {
        if (!directorBranchId) {
          return new Response(JSON.stringify({ error: "Director branch not set" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        metadata.branch_id = directorBranchId;
      }
    }

    console.log("[admin-create-user] Creating user", { email, requestedRole, callerRole });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      console.error("[admin-create-user] Auth Error", { message: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[admin-create-user] Fatal Error", { message: error?.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});