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
        }

        return new Response("ok", { status: 200 });

    } catch (error) {
        console.error("Callback Error:", error);
        return new Response("error", { status: 400 });
    }
});
