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

        // 1. Find the user in the public tables first (to verify they are our user)
        const [{ data: member }, { data: staff }] = await Promise.all([
            supabaseAdmin.from("members").select("user_id").eq("email", email).maybeSingle(),
            supabaseAdmin.from("staff").select("user_id").eq("email", email).maybeSingle()
        ]);

        const userId = member?.user_id || staff?.user_id;

        if (!userId) {
            throw new Error("This email is not registered in our system.");
        }

        // 2. Update the password in Auth using the ID
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
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