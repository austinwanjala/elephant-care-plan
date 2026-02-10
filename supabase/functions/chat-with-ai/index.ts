
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { query } = await req.json();
        const openAiKey = Deno.env.get("OPENAI_API_KEY");

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch Membership Categories for Context
        const { data: categories, error: dbError } = await supabase
            .from("membership_categories")
            .select("name, payment_amount, benefit_amount")
            .eq("is_active", true);

        if (dbError) {
            console.error("Database Error:", dbError);
            throw new Error("Failed to fetch scheme details.");
        }

        const schemeContext = categories
            ? categories.map(c =>
                `- ${c.name}: Costs KES ${c.payment_amount}, provides KES ${c.benefit_amount} limit.`
            ).join("\n")
            : "No active schemes found.";

        const systemPrompt = `
You are a helpful assistant for "Elephant Dental", a dental insurance provider.
Your goal is to answer user questions about our membership schemes based ONLY on the following information:

${schemeContext}

General Info:
- There is a registration fee of KES 500.
- There is an annual management fee of KES 1000.
- Dependants can be added.
- Members can visit any of our active branches.

Tone: Professional, friendly, and concise.
If the user asks something outside this scope, politely say you can only answer questions about the dental schemes.
`;

        // If no OpenAI key, return mock response
        if (!openAiKey) {
            console.log("No OPENAI_API_KEY found in environment variables.");
            return new Response(JSON.stringify({
                reply: "I'm currently running in demo mode (no API key set). Here is a sample response: 'Our plans range from Level 1 to Level 5, offering coverage up to KES 100,000.'"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`OpenAI Key found. Length: ${openAiKey.length}`);

        // Call OpenAI
        const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openAiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query }
                ],
                temperature: 0.7,
            }),
        });

        if (!openAiResponse.ok) {
            const errText = await openAiResponse.text();
            console.error("OpenAI API Error:", errText);
            throw new Error(`OpenAI API Error: ${openAiResponse.status} ${openAiResponse.statusText}`);
        }

        const aiData = await openAiResponse.json();

        if (aiData.error) {
            throw new Error(aiData.error.message);
        }

        const reply = aiData.choices[0].message.content;

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error in chat-with-ai function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
