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
        // TEMPORARY DEBUG: Hardcoding known working keys to bypass Secrets/Env issues
        const consumerKey = "v1kPFlj2iuxDpeBP7EJ2aD2qushYsMUJHGXdBzhVdPqvvYiQ";
        const consumerSecret = "cJlol8jez8DmYqikYljAyASTqEyFr4dNTi2F0HyPsgoDVW8fLKFObh3GJ5rQDfsP";
        const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
        const shortcode = "174379";
        const callbackUrl = "https://wtzdddcogjtzzmgjbbvz.supabase.co/functions/v1/mpesa-callback";

        if (!consumerKey || !consumerSecret) {
            throw new Error("Server misconfiguration: Hardcoded keys missing");
        }




        // Sanitize Phone Number
        let formattedPhone = phone.replace(/[^0-9]/g, "");
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "254" + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith("254")) {
            // ok
        } else {
            // Assume it needs prefix if it's 9 digits? Safest to just prepend 254 if not present?
            // But for Kenya standard is 254... 
            // If length is 9 (e.g. 712345678), add 254.
            if (formattedPhone.length === 9) formattedPhone = "254" + formattedPhone;
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        console.log("[mpesa-stk-push] Fetching access token...");

        const authResponse = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: { "Authorization": `Basic ${auth}` }
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
            throw new Error(`Failed to authenticate with M-Pesa: ${JSON.stringify(authData)}`);
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
            PartyA: formattedPhone,
            PartyB: shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: callbackUrl,
            AccountReference: "ElephantCare",
            TransactionDesc: "Membership Payment"
        };

        console.log("[mpesa-stk-push] Initiating STK Push for:", formattedPhone, "Amount:", amount);

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
            throw new Error(`STK Push failed: ${stkData.errorMessage || stkData.ResponseDescription || "Unknown Error"}`);
        }

        // 4. Record Payment as Pending in DB
        const supabase = createClient(
            (Deno.env.get("SUPABASE_URL") ?? "").trim(),
            (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim()
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

        if (dbError) {
            console.error("DB Error:", dbError);
        }

        return new Response(JSON.stringify(stkData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("Error:", error);

        // DEBUG: Return secret info in error
        const consumerKey = (Deno.env.get("MPESA_CONSUMER_KEY") ?? "").trim();
        const debugInfo = {
            keyLen: consumerKey.length,
            keyStart: consumerKey.substring(0, 3),
            message: error.message || "Unknown error"
        };

        return new Response(JSON.stringify({ error: debugInfo }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
