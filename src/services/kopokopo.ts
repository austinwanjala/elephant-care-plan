import { supabase } from "@/integrations/supabase/client";

export const kopokopoService = {
    async initiateStkPush(params: {
        amount: number;
        phone: string;
        memberId: string;
        paymentType?: string;
        invoiceNumber?: string;
        coverageAmount?: number;
    }) {
        const { data, error } = await supabase.functions.invoke("kopokopo", {
            body: {
                action: "stkpush",
                ...params,
            },
        });

        if (error) throw error;
        return data;
    },

    async checkStatus(resourceId: string) {
        const { data, error } = await supabase.functions.invoke("kopokopo", {
            body: {
                action: "status",
                resourceId,
            },
        });

        if (error) throw error;
        return data;
    }
};
