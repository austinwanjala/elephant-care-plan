import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsPayload {
    type: 'welcome' | 'payment_confirmation' | 'billing_completion' | 'low_balance' | 'payment_failed' | 'otp';
    phone: string;
    email?: string;
    data: any;
}

// Helper to format phone number to E.164 (e.g., +254...)
const formatPhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload: SmsPayload = await req.json();
        const { type, phone, email, data } = payload;

        if (!phone) {
            throw new Error("Phone number is required");
        }

        const formattedPhone = formatPhone(phone);
        let message = "";
        let subject = "Elephant Dental Notification";

        switch (type) {
            case 'otp':
                message = `Your Elephant Dental verification code is: ${data.code}. Valid for 10 minutes.`;
                subject = "Your Verification Code";
                break;
            case 'welcome':
                message = `Hello ${data.name}, welcome to Elephant Dental. Your account has been created successfully. Please log in to choose your scheme and complete payment.`;
                subject = "Welcome to Elephant Dental";
                break;
            case 'payment_confirmation':
                message = `Payment received. Your scheme is now active with coverage of Ksh ${data.benefit_amount}.`;
                subject = "Payment Confirmed - Coverage Active";
                break;
            case 'billing_completion':
                message = `Your visit has been processed. Ksh ${data.benefit_cost} has been deducted from your coverage. Remaining balance: Ksh ${data.balance}.`;
                subject = "Visit Processed - Billing Summary";
                break;
            default:
                message = `Notification from Elephant Dental: ${JSON.stringify(data)}`;
        }

        console.log(`[send-sms][${type}] Attempting to notify ${formattedPhone} / ${email || 'no-email'}`);

        // 1. Try SMS via Africa's Talking
        const AT_USERNAME = Deno.env.get("AFRICASTALKING_USERNAME");
        const AT_API_KEY = Deno.env.get("AFRICASTALKING_API_KEY");
        let smsResult = { success: false, message: "Provider not configured" };

        if (AT_USERNAME && AT_API_KEY) {
            try {
                const formData = new URLSearchParams();
                formData.append('username', AT_USERNAME);
                formData.append('to', formattedPhone);
                formData.append('message', message);

                const isSandbox = AT_USERNAME.toLowerCase() === 'sandbox';
                const atUrl = isSandbox
                    ? 'https://api.sandbox.africastalking.com/version1/messaging'
                    : 'https://api.africastalking.com/version1/messaging';

                console.log(`[send-sms] Using Africa's Talking Env: ${isSandbox ? 'SANDBOX' : 'LIVE'}`);

                const response = await fetch(atUrl, {
                    method: 'POST',
                    headers: {
                        'apiKey': AT_API_KEY,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: formData.toString()
                });

                const result = await response.json();
                console.log("[send-sms] Africa's Talking Response:", result);
                smsResult = { success: true, ...result };
            } catch (err) {
                console.error("[send-sms] SMS Provider Error:", err);
            }
        }

        // 2. Try Email via Resend (if email provided and key exists)
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        let emailResult = { success: false, message: "Provider not configured or no email provided" };

        if (RESEND_API_KEY && email) {
            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: 'Elephant Dental <notifications@elephantdental.co.ke>',
                        to: [email],
                        subject: subject,
                        html: `<p>${message}</p>`
                    })
                });
                const result = await res.json();
                console.log("[send-sms] Resend Response:", result);
                emailResult = { success: true, ...result };
            } catch (err) {
                console.error("[send-sms] Email Provider Error:", err);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            sms: smsResult,
            email: emailResult,
            debug_message: message
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("[send-sms] Fatal Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});