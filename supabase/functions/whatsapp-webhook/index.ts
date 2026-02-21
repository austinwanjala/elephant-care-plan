import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
    const { method } = req;

    if (method === "GET") {
        // Webhook verification
        const url = new URL(req.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
            return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
    }

    try {
        const body = await req.json();
        console.log("[whatsapp-webhook] Received:", JSON.stringify(body));

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (value?.statuses) {
            for (const status of value.statuses) {
                const messageId = status.id;
                const statusName = status.status; // sent, delivered, read, failed

                // Update log status in DB
                await supabase
                    .from("whatsapp_logs")
                    .update({
                        status: statusName,
                        updated_at: new Date().toISOString()
                    })
                    .filter("meta_payload->messages->0->id", "eq", messageId);

                console.log(`[whatsapp-webhook] Updated message ${messageId} to ${statusName}`);
            }
        }

        return new Response("OK", { status: 200 });
    } catch (error: any) {
        console.error("[whatsapp-webhook] Error:", error.message);
        return new Response("Internal Error", { status: 500 });
    }
});
