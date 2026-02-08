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
        const body = await req.json();
        console.log("[mpesa-callback] Received payload:", JSON.stringify(body));

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Log the raw attempt for debugging
        await supabase.from("system_logs").insert({
            action: "MPESA_CALLBACK_RECEIVED",
            details: body,
        });

        const stkCallback = body.Body?.stkCallback;
        if (!stkCallback) {
            throw new Error("Invalid M-Pesa callback structure: Missing stkCallback");
        }

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

        // Extract metadata values
        let mpesaReceipt = null;
        let amount = null;
        let phoneNumber = null;

        if (CallbackMetadata?.Item) {
            const items = CallbackMetadata.Item;
            mpesaReceipt = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
            amount = items.find((i: any) => i.Name === "Amount")?.Value;
            phoneNumber = items.find((i: any) => i.Name === "PhoneNumber")?.Value;
        }

        if (ResultCode === 0) {
            console.log(`[mpesa-callback] Success: ${CheckoutRequestID}, Receipt: ${mpesaReceipt}`);
            
            const { data, error } = await supabase
                .from("payments")
                .update({
                    status: "completed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc,
                    mpesa_reference: mpesaReceipt,
                    payment_date: new Date().toISOString()
                })
                .eq("mpesa_checkout_request_id", CheckoutRequestID)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                console.warn(`[mpesa-callback] No pending payment found for CheckoutID: ${CheckoutRequestID}`);
            }

            await supabase.from("system_logs").insert({
                action: "MPESA_CALLBACK_SUCCESS",
                details: { checkoutId: CheckoutRequestID, receipt: mpesaReceipt, amount },
            });
        } else {
            console.log(`[mpesa-callback] Failed/Cancelled: ${CheckoutRequestID}, Code: ${ResultCode}`);
            
            await supabase
                .from("payments")
                .update({
                    status: "failed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc
                })
                .eq("mpesa_checkout_request_id", CheckoutRequestID);

            await supabase.from("system_logs").insert({
                action: "MPESA_CALLBACK_FAILED",
                details: { checkoutId: CheckoutRequestID, error: ResultDesc, code: ResultCode },
            });
        }

        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("[mpesa-callback] Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});