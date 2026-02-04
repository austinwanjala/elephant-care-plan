
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsPayload {
    type: 'welcome' | 'payment_confirmation' | 'billing_completion' | 'low_balance' | 'payment_failed';
    phone: string;
    data: any;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload: SmsPayload = await req.json();
        const { type, phone, data } = payload;

        if (!phone) {
            throw new Error("Phone number is required");
        }

        let message = "";

        switch (type) {
            case 'welcome':
                message = `Hello ${data.name}, welcome to our Hospital Prepaid Medical Scheme. Your account has been created successfully. Please log in to choose your scheme and complete payment to activate your benefits.`;
                break;
            case 'payment_confirmation':
                // Expected data: { level: string, benefit_amount: number }
                message = `Payment received. Your scheme is now active with coverage of Ksh ${data.benefit_amount}.`;
                break;
            case 'billing_completion':
                // Expected data: { benefit_cost: number, balance: number }
                message = `Your visit has been processed. Ksh ${data.benefit_cost} has been deducted from your coverage. Remaining balance: Ksh ${data.balance}.`;
                break;
            case 'low_balance':
                // Expected data: { balance: number }
                message = `Your prepaid scheme balance is low (Ksh ${data.balance}). Please top up or renew to continue enjoying services.`;
                break;
            case 'payment_failed':
                message = `Your payment was not completed. Please try again.`;
                break;
            default:
                throw new Error("Invalid SMS type");
        }

        console.log(`[SMS][${type}] Sending to ${phone}: ${message}`);

        const AT_USERNAME = Deno.env.get("AFRICASTALKING_USERNAME");
        const AT_API_KEY = Deno.env.get("AFRICASTALKING_API_KEY");

        if (AT_USERNAME && AT_API_KEY) {
            const formData = new URLSearchParams();
            formData.append('username', AT_USERNAME);
            formData.append('to', phone);
            formData.append('message', message);

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
        } else {
            console.log("[MOCK SMS] Africa's Talking credentials not set.");
            return new Response(JSON.stringify({ success: true, mocked: true, message }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

    } catch (error) {
        console.error("Error sending SMS:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
