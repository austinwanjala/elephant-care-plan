import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { amount, phone, member_id, coverage_amount } = await req.json();

        if (!amount || !phone || !member_id) {
            throw new Error("Missing required fields: amount, phone, member_id");
        }

        // 1. Get Configuration from Environment Variables
        const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const passkey = Deno.env.get("MPESA_PASSKEY");
        const shortcode = Deno.env.get("MPESA_BUSINESS_SHORTCODE") || "174379";
        const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL");

        if (!consumerKey || !consumerSecret || !passkey || !callbackUrl) {
            throw new Error("Server misconfiguration: M-Pesa credentials missing in environment variables.");
        }

        // Sanitize Phone Number (Ensure 254 format)
        let formattedPhone = phone.replace(/[^0-9]/g, "");
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "254" + formattedPhone.slice(1);
        } else if (!formattedPhone.startsWith("254") && formattedPhone.length === 9) {
            formattedPhone = "254" + formattedPhone;
        }

        console.log(`[mpesa-stk-push] Initiating request for ${formattedPhone} - Amount: ${amount}`);

        // 2. Get Access Token
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const authResponse = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: { "Authorization": `Basic ${auth}` }
        });

        const authData = await authResponse.json();
        if (!authData.access_token) {
            throw new Error(`M-Pesa Auth Failed: ${JSON.stringify(authData)}`);
        }

        const accessToken = authData.access_token;

        // 3. Prepare STK Push
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
        const password = btoa(`${shortcode}${passkey}${timestamp}`);

        const stkPayload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.ceil(amount),
            PartyA: formattedPhone,
            PartyB: shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: callbackUrl,
            AccountReference: "ElephantCare",
            TransactionDesc: "Membership Payment"
        };

        // 4. Send STK Push Request
        const stkResponse = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(stkPayload)
        });

        const stkData = await stkResponse.json();
        if (stkData.ResponseCode !== "0") {
            throw new Error(`STK Push failed: ${stkData.errorMessage || stkData.ResponseDescription || "Unknown Error"}`);
        }

        // 5. Record Payment as Pending in DB
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { error: dbError } = await supabase.from("payments").insert({
            member_id,
            amount: amount,
            coverage_added: coverage_amount || amount,
            mpesa_checkout_request_id: stkData.CheckoutRequestID,
            mpesa_merchant_request_id: stkData.MerchantRequestID,
            phone_used: formattedPhone,
            status: "pending"
        });

        if (dbError) console.error("[mpesa-stk-push] DB Error:", dbError);

        return new Response(JSON.stringify(stkData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("[mpesa-stk-push] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});