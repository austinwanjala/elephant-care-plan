import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppPayload {
    phone: string;
    template: string;
    data: any;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("[send-whatsapp] Incoming request...");
        const payload: WhatsAppPayload = await req.json();
        const { phone, template, data } = payload;

        const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
        const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

        if (!WHATSAPP_TOKEN || !PHONE_ID) {
            throw new Error("WhatsApp credentials not configured in environment.");
        }

        // Format phone to 254... or similar (Meta requires no +)
        const formattedPhone = phone.replace(/\+/g, '').replace(/^0/, '254');

        // Construct dynamic components based on payload data
        const components: any[] = [];

        // Example: logic to map 'data' to template parameters
        // For 'member_welcome', {{1}} might be name.
        if (template === 'member_welcome') {
            components.push({
                type: "body",
                parameters: [{ type: "text", text: data.name }]
            });
        } else if (template === 'cover_activation') {
            components.push({
                type: "body",
                parameters: [
                    { type: "text", text: data.name },
                    { type: "text", text: data.balance }
                ]
            });
        }
        // ... (Add mappings for all templates listed in requirements)

        console.log(`[send-whatsapp] Sending ${template} to ${formattedPhone}`);

        const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: "template",
                template: {
                    name: template,
                    language: { code: "en_US" },
                    components: components
                }
            })
        });

        const result = await response.json();
        console.log("[send-whatsapp] Meta Response:", result);

        if (!response.ok) {
            console.error("[send-whatsapp] Meta API Error Details:", JSON.stringify(result));
            return new Response(JSON.stringify({ error: result }), {
                status: response.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[send-whatsapp] Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
