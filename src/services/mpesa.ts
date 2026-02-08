import { supabase } from "@/integrations/supabase/client";

export interface MpesaRequest {
    amount: number;
    phone: string;
    member_id: string;
    coverage_amount?: number;
}

export const mpesaService = {
    /**
     * Initiates an STK Push request to the user's phone.
     */
    initiateStkPush: async (request: MpesaRequest) => {
        const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
            body: request
        });

        if (error) {
            let errorMessage = error.message;
            if (error instanceof Error && 'context' in error) {
                try {
                    // @ts-ignore
                    const body = await error.context.json();
                    if (body && body.error) {
                        errorMessage = body.error;
                    }
                } catch (e) {}
            }
            throw new Error(errorMessage);
        }
        return data; // Contains CheckoutRequestID
    },

    /**
     * Listens for payment status updates for a specific transaction.
     */
    subscribeToCheckoutStatus: (checkoutId: string, onUpdate: (payload: any) => void) => {
        return supabase
            .channel(`payment-${checkoutId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'payments',
                    filter: `mpesa_checkout_request_id=eq.${checkoutId}`
                },
                (payload) => {
                    console.log("Realtime update received:", payload.new);
                    onUpdate(payload.new);
                }
            )
            .subscribe();
    },

    /**
     * Manually check the status of a payment in the database.
     */
    checkPaymentStatus: async (checkoutId: string) => {
        const { data, error } = await supabase
            .from("payments")
            .select("*")
            .eq("mpesa_checkout_request_id", checkoutId)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    }
};