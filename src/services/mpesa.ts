import { kopokopoService } from "./kopokopo";

/**
 * @deprecated Use kopokopoService instead.
 * Redirecting mpesaService to kopokopoService to ensure all STK pushes go through KopoKopo.
 */
export const mpesaService = {
    initiateStkPush: async (request: { amount: number; phone: string; member_id: string; coverage_amount?: number }) => {
        console.warn("mpesaService is deprecated. Redirecting to kopokopoService.");
        return kopokopoService.initiateStkPush({
            amount: request.amount,
            phone: request.phone,
            memberId: request.member_id,
            coverageAmount: request.coverage_amount,
            paymentType: "Legacy M-Pesa Migration",
            invoiceNumber: `MIG-${Date.now()}`
        });
    }
};