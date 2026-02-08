import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
    try {
        const data = await req.json();
        console.log("Callback Data:", JSON.stringify(data));

        const { Body } = data;
        const { stkCallback } = Body;

        if (!stkCallback) {
            throw new Error("Invalid callback structure");
        }

        const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        if (ResultCode === 0) {
            // Success
            console.log(`Payment Successful for CheckoutID: ${CheckoutRequestID}`);

            // Extract M-Pesa Receipt Number (if needed)
            const callbackMetadata = stkCallback.CallbackMetadata?.Item;
            const mpesaReceipt = callbackMetadata?.find((item: any) => item.Name === "MpesaReceiptNumber")?.Value;

            // Update Database
            const { error } = await supabase
                .from("payments")
                .update({
                    status: "completed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc,
                    mpesa_reference: mpesaReceipt
                })
                .eq("mpesa_checkout_request_id", CheckoutRequestID);

            if (error) console.error("DB Update Error (Success):", error);

            // Log to system_logs
            await supabase.from("system_logs").insert({
                action: "MPESA_CALLBACK_SUCCESS",
                details: { checkoutId: CheckoutRequestID, receipt: mpesaReceipt, amount: stkCallback.Amount },
            });

            // Broadcast to client
            const channel = supabase.channel(`payment-${CheckoutRequestID}`);
            await channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'payment-update',
                        payload: { status: 'completed', mpesa_reference: mpesaReceipt, amount: stkCallback.Amount }
                    });
                    supabase.removeChannel(channel);
                }
            });

        } else {
            // Failed / Cancelled
            console.log(`Payment Failed (${ResultCode}): ${ResultDesc}`);

            const { error } = await supabase
                .from("payments")
                .update({
                    status: "failed",
                    mpesa_result_code: ResultCode,
                    mpesa_result_desc: ResultDesc
                })
                .eq("mpesa_checkout_request_id", CheckoutRequestID);

            if (error) console.error("DB Update Error (Failure):", error);

            // Log to system_logs
            await supabase.from("system_logs").insert({
                action: "MPESA_CALLBACK_FAILED",
                details: { checkoutId: CheckoutRequestID, error: ResultDesc, code: ResultCode },
            });

            // Broadcast to client
            const channel = supabase.channel(`payment-${CheckoutRequestID}`);
            await channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'payment-update',
                        payload: { status: 'failed', mpesa_result_desc: ResultDesc }
                    });
                    supabase.removeChannel(channel);
                }
            });
        }

        return new Response("ok", { status: 200 });

    } catch (error) {
        console.error("Callback Error:", error);
        return new Response("error", { status: 400 });
    }
});
