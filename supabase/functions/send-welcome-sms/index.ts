
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { phone, name } = await req.json();

        if (!phone) {
            throw new Error("Phone number is required");
        }

        const message = `Welcome to Elephant Dental, ${name}! We are excited to have you on board. Please log in to complete your profile and select a membership plan.`;

        // Initialize SMS sending logic
        // This example uses Africa's Talking, a common provider in Kenya (KES context)
        // You can easily swap this for Twilio or another provider.

        const AT_USERNAME = Deno.env.get("sandbox");
        const AT_API_KEY = Deno.env.get("atsk_b9284f4fce1ae0c6573157b549bf91b33cbc81743c9b1a0416f3fe93273354364a222eca");

        if (AT_USERNAME && AT_API_KEY) {
            console.log(`Sending SMS to ${phone} via Africa's Talking...`);

            const credentials = {
                username: AT_USERNAME,
                apiKey: AT_API_KEY
            };

            // Basic Africa's Talking implementation via HTTP
            const formData = new URLSearchParams();
            formData.append('username', AT_USERNAME);
            formData.append('to', phone);
            formData.append('message', message);
            // formData.append('from', 'SHORTCODE'); // Optional if you have a shortcode

            const response = await fetch('https://api.africastalking.com/version1/messaging', {
                method: 'POST',
                headers: {
                    'apiKey': AT_API_KEY,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData.toString()
            });

            const result = await response.json();
            console.log("Africa's Talking Response:", result);

            return new Response(JSON.stringify({ success: true, provider: "africastalking", data: result }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        }

        // Fallback/Mock behavior if no keys are set (for development)
        console.log(`[MOCK SMS] To: ${phone}, Message: ${message}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "SMS logged (no provider configured)",
                mock: true
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
