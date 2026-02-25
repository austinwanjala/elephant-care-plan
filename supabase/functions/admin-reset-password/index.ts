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
            throw new Error("Email and new password are required");
        }

        // 1. Find the user in the public tables first (to verify they are our user)
        const [{ data: member }, { data: staff }] = await Promise.all([
            supabaseAdmin.from("members").select("user_id, full_name, phone, email").eq("email", email).maybeSingle(),
            supabaseAdmin.from("staff").select("user_id, full_name, phone, email").eq("email", email).maybeSingle()
        ]);

        const user = member || staff;

        if (!user) {
            throw new Error("This email is not registered in our system.");
        }

        // 2. Update the password in Auth using the ID
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.user_id,
            { password: password }
        );

        if (updateError) throw updateError;

        // 3. Store audit log
        await supabaseAdmin.from("system_logs").insert({
            action: "ADMIN_PASSWORD_RESET",
            user_id: admin_id || null,
            details: {
                target_user_id: user.user_id,
                target_email: email,
                performed_by: admin_id,
                message: "Password reset performed by admin"
            }
        });

        // 4. Send notification
        if (user.phone) {
            try {
                // We call the send-sms function internally or just use the same logic
                // For simplicity here, let's assume we trigger it via another fetch or common utility if possible.
                // Since Deno functions are isolated, we fetch the other function's URL.
                const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`;
                await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'password_reset',
                        phone: user.phone,
                        email: user.email,
                        data: {
                            name: user.full_name,
                            password: password
                        }
                    })
                });
            } catch (notifyError) {
                console.error("Failed to send notification:", notifyError);
            }
        }

        return new Response(JSON.stringify({ message: "Password updated successfully and notification sent" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});