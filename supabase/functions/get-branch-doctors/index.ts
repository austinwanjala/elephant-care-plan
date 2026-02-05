import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { branch_id } = await req.json();

    if (!branch_id) {
        return new Response(JSON.stringify({ error: "branch_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Use Service Role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get all active staff in the branch
    const { data: staffData, error: staffError } = await supabaseAdmin
        .from("staff")
        .select("id, full_name, user_id")
        .eq("branch_id", branch_id)
        .eq("is_active", true); // Ensure we only get active staff

    if (staffError) throw staffError;

    if (!staffData || staffData.length === 0) {
        return new Response(JSON.stringify({ doctors: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // 2. Get roles for these users to filter for 'doctor'
    const userIds = staffData.map(s => s.user_id);
    const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .eq("role", "doctor");

    if (rolesError) throw rolesError;

    const doctorUserIds = new Set(userRoles.map(r => r.user_id));
    
    // 3. Filter staff list
    const doctors = staffData
        .filter(s => doctorUserIds.has(s.user_id))
        .map(d => ({
            id: d.id,
            full_name: d.full_name
        }));

    return new Response(JSON.stringify({ doctors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
