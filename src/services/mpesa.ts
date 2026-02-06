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

        if (error) throw error;
        return data;
    },

    /**
     * Listens for payment status updates for a specific member.
     */
    subscribeToPaymentStatus: (memberId: string, onUpdate: (payload: any) => void) => {
        return supabase
            .channel(`payment-status-${memberId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'payments',
                    filter: `member_id=eq.${memberId}`
                },
                (payload) => onUpdate(payload.new)
            )
            .subscribe();
    }
};