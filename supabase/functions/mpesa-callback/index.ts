import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight requests
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

        // Log the callback receipt
        await supabase.from("system_logs").insert({
            action: "MPESA_CALLBACK_RECEIVED",
            details: { checkoutId: CheckoutRequestID, code: ResultCode, desc: ResultDesc },
        });

        if (ResultCode === 0) {
            let mpesaReceipt: string | null = null;
            if (CallbackMetadata?.Item) {
                mpesaReceipt = CallbackMetadata.Item.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || null;
            }

            // Update the payment record
            // Save MpesaReceiptNumber BOTH as mpesa_code and mpesa_reference (legacy compatibility)
            const { data, error } = await supabase
                .from("payments")
                .update({
                    status: "completed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc,
                    mpesa_code: mpesaReceipt,
                    mpesa_reference: mpesaReceipt,
                    payment_date: new Date().toISOString()
                })
                .eq("mpesa_checkout_request_id", CheckoutRequestID)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                console.error(`[mpesa-callback] No pending payment found for CheckoutID: ${CheckoutRequestID}`);
            } else {
                await supabase.from("system_logs").insert({
                    action: "MPESA_CALLBACK_SUCCESS",
                    details: { checkoutId: CheckoutRequestID, receipt: mpesaReceipt },
                });
            }
        } else {
            // Mark as failed if ResultCode is not 0
            await supabase
                .from("payments")
                .update({
                    status: "failed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc,
                    mpesa_code: null,
                    mpesa_reference: null
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
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});