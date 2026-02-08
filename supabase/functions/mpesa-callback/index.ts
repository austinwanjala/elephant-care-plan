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

        const stkCallback = body.Body?.stkCallback;
        if (!stkCallback) throw new Error("Invalid M-Pesa payload: Missing stkCallback");

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

        // Log the attempt
        await supabase.from("system_logs").insert({
            action: "MPESA_CALLBACK_RECEIVED",
            details: { checkoutId: CheckoutRequestID, code: ResultCode, desc: ResultDesc },
        });

        if (ResultCode === 0) {
            let mpesaReceipt = null;
            if (CallbackMetadata?.Item) {
                mpesaReceipt = CallbackMetadata.Item.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
            }

            // Perform the update and check if any rows were affected
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
                const errorMsg = `No pending payment found in DB for CheckoutID: ${CheckoutRequestID}`;
                console.error(`[mpesa-callback] ${errorMsg}`);
                await supabase.from("system_logs").insert({
                    action: "MPESA_CALLBACK_ERROR",
                    details: { error: errorMsg, checkoutId: CheckoutRequestID },
                });
                throw new Error(errorMsg);
            }

            await supabase.from("system_logs").insert({
                action: "MPESA_CALLBACK_SUCCESS",
                details: { checkoutId: CheckoutRequestID, receipt: mpesaReceipt },
            });
        } else {
            await supabase
                .from("payments")
                .update({
                    status: "failed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc
                })
                .eq("mpesa_checkout_request_id", CheckoutRequestID);
        }

        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("[mpesa-callback] Fatal Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});