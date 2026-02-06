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

        // 1. Get Access Token
        const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const passkey = Deno.env.get("MPESA_PASSKEY");
        const shortcode = Deno.env.get("MPESA_BUSINESS_SHORTCODE");
        const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL");

        if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
            console.error("Missing secrets:", { 
                hasConsumerKey: !!consumerKey, 
                hasConsumerSecret: !!consumerSecret, 
                hasShortcode: !!shortcode, 
                hasPasskey: !!passkey, 
                hasCallbackUrl: !!callbackUrl 
            });
            throw new Error("Server misconfiguration: Missing M-Pesa secrets");
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        console.log("[mpesa-stk-push] Fetching access token...");
        console.log("[mpesa-stk-push] Using consumer key starting with:", consumerKey.substring(0, 5));
        
        const authResponse = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            method: "GET",
            headers: { 
                "Authorization": `Basic ${auth}`,
                "Accept": "application/json"
            }
        });

        const authText = await authResponse.text();
        console.log("[mpesa-stk-push] Auth response status:", authResponse.status);
        console.log("[mpesa-stk-push] Auth response:", authText);
        
        let authData;
        try {
            authData = JSON.parse(authText);
        } catch {
            throw new Error(`M-Pesa auth failed - invalid response: ${authText}`);
        }

        if (!authData.access_token) {
            console.error("Auth failed:", authData);
            throw new Error(`Failed to authenticate with M-Pesa: ${authData.errorMessage || authText}`);
        }

        const accessToken = authData.access_token;
        console.log("[mpesa-stk-push] Got access token");

        // 2. Prepare STK Push
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
        const password = btoa(`${shortcode}${passkey}${timestamp}`);

        const stkPayload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.ceil(amount),
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: callbackUrl,
            AccountReference: "ElephantCare",
            TransactionDesc: "Membership Payment"
        };

        console.log("[mpesa-stk-push] Initiating STK Push for:", phone, "Amount:", amount);

        // 3. Send STK Push Request
        const stkResponse = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(stkPayload)
        });

        const stkText = await stkResponse.text();
        console.log("[mpesa-stk-push] STK Response:", stkText);

        let stkData;
        try {
            stkData = JSON.parse(stkText);
        } catch {
            throw new Error(`M-Pesa STK response invalid: ${stkText}`);
        }

        if (stkData.ResponseCode !== "0") {
            throw new Error(stkData.errorMessage || stkData.CustomerMessage || "STK Push failed to initiate");
        }

        // 4. Record Payment as Pending in DB
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
            phone_used: phone,
            status: "pending"
        });

        if (dbError) {
            console.error("DB Error:", dbError);
        }

        return new Response(JSON.stringify(stkData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: unknown) {
        console.error("Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
