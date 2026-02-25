// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
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
            // @ts-ignore
            Deno.env.get("SUPABASE_URL") ?? "",
            // @ts-ignore
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        const { email, password, admin_id } = await req.json();

        if (!email || !password) {
            console.error("[admin-reset-password] Missing email or password");
            throw new Error("Email and new password are required");
        }

        const normalizedEmail = email.toLowerCase().trim();
        console.log(`[admin-reset-password] Attempting reset for: ${normalizedEmail}`);

        // 1. Find the user in the public tables (members, staff, or marketers)
        const [memberRes, staffRes, marketerRes] = await Promise.all([
            supabaseAdmin.from("members").select("user_id, full_name, phone, email").ilike("email", normalizedEmail).maybeSingle(),
            supabaseAdmin.from("staff").select("user_id, full_name, phone, email").ilike("email", normalizedEmail).maybeSingle(),
            supabaseAdmin.from("marketers").select("user_id, full_name, phone, email").ilike("email", normalizedEmail).maybeSingle()
        ]);

        if (memberRes.error) console.error("[admin-reset-password] Member lookup error:", memberRes.error);
        if (staffRes.error) console.error("[admin-reset-password] Staff lookup error:", staffRes.error);
        if (marketerRes.error) console.error("[admin-reset-password] Marketer lookup error:", marketerRes.error);

        const targetUser = memberRes.data || staffRes.data || marketerRes.data;

        if (!targetUser) {
            console.error(`[admin-reset-password] User not found for email: ${normalizedEmail}`);
            throw new Error(`User with email ${normalizedEmail} not found in members, staff, or marketers.`);
        }

        if (!targetUser.user_id) {
            console.error(`[admin-reset-password] User found but missing user_id:`, targetUser);
            throw new Error("User record found but it's missing the associated authentication ID.");
        }

        console.log(`[admin-reset-password] Found user: ${targetUser.user_id}. Updating Auth...`);

        // 2. Update the password in Auth using the ID
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUser.user_id,
            { password: password }
        );

        if (updateError) {
            console.error("[admin-reset-password] Auth update error:", updateError.message);
            throw new Error(`Auth Update Error: ${updateError.message}`);
        }

        console.log(`[admin-reset-password] Auth updated. Logging action...`);

        // 3. Store audit log
        try {
            const { error: logError } = await supabaseAdmin.from("system_logs").insert({
                action: "ADMIN_PASSWORD_RESET",
                user_id: admin_id && typeof admin_id === 'string' && admin_id.trim() !== '' ? admin_id : null,
                details: {
                    target_user_id: targetUser.user_id,
                    target_email: normalizedEmail,
                    performed_by: admin_id || 'self_reset',
                    message: "Password reset performed"
                }
            });
            if (logError) console.error("[admin-reset-password] Audit log error:", logError.message);
        } catch (e) {
            console.error("[admin-reset-password] Silent failure in logging:", e);
        }

        return new Response(JSON.stringify({ message: "Password updated successfully" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("[admin-reset-password] Global Catch:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});