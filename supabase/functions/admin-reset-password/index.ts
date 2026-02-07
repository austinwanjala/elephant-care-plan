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

        const { email, password } = await req.json();

        if (!email || !password) {
            throw new Error("Email and new password are required");
        }

        // 1. Find the user by email
        // listUsers with a query is the standard admin way to search
        const { data: { users }, error: searchError } = await supabaseAdmin.auth.admin.listUsers();

        if (searchError) throw searchError;

        // Filter manually because listUsers query matches partials too, we want exact
        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!user) {
            throw new Error("User not found");
        }

        // 2. Update the password
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: password }
        );

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ message: "Password updated successfully" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
