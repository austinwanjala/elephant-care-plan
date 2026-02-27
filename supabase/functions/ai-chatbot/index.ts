import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jsonBody = await req.json().catch(() => ({}));
    const { message, history = [] } = jsonBody;

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are "Effie", the Elephant Dental Assistant. You are a friendly, helpful, and professional AI.
Context: Elephant Dental is a modern dental health provider in Kenya. 
Core Offer: "2x Coverage" - Pay KES 500, get KES 1,000 coverage. 
Minimum: KES 500. 
Registration: 1. Register, 2. Pay via M-Pesa STK Push, 3. Get Digital Card (QR code).
Branches: Head Office in Meru, expanding nationwide.
Contact: +254 710 500 500, info@elephantdental.org.
Tone: Professional, welcoming, slightly elephant-themed.
Rules: Stay on topic (dental care/membership). Be concise. Use bolding for emphasis.`;

    const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    console.log(`[ai-chatbot] Processing request. Gemini Key: ${!!geminiKey}, OpenAI Key: ${!!openAiKey}`);

    if (geminiKey) {
      console.log("[ai-chatbot] Using Gemini API");

      // GEMINI v1beta requires alternating roles: user, model, user, model...
      // And it doesn't support 'system' role in 'contents' the same way.
      // We'll combine systemPrompt into the first message or use system_instruction.

      const contents = [];

      // Process history into Gemini format
      // We must ensure they alternate user/model
      let lastRole = "";

      // Combine systemPrompt with the first user message if history is empty
      if (history.length === 0) {
        contents.push({
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }]
        });
      } else {
        // Prepend system prompt to the context if we have history
        contents.push({
          role: "user",
          parts: [{ text: `Instruction: ${systemPrompt}` }]
        });
        contents.push({
          role: "model",
          parts: [{ text: "Understood. I am Effie, your Elephant Dental Assistant. How can I help today?" }]
        });

        // Add history
        for (const h of history) {
          const role = h.role === "assistant" ? "model" : "user";
          // Basic check to ensure alternating roles
          if (role !== lastRole) {
            contents.push({
              role: role,
              parts: [{ text: h.content }]
            });
            lastRole = role;
          }
        }

        // Final message
        if (lastRole !== "user") {
          contents.push({
            role: "user",
            parts: [{ text: message }]
          });
        } else {
          // If the last one was user, we append to it (unlikely but safe)
          contents[contents.length - 1].parts[0].text += `\n\nFollow-up: ${message}`;
        }
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[ai-chatbot] Gemini Error Response:", JSON.stringify(errorData));
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

      return new Response(JSON.stringify({ response: aiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (openAiKey) {
      console.log("[ai-chatbot] Using OpenAI API");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
            { role: "user", content: message }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[ai-chatbot] OpenAI Error Response:", JSON.stringify(errorData));
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      return new Response(JSON.stringify({ response: aiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.log("[ai-chatbot] Falling back to static knowledge base (No API Keys)");

      let fallbackResponse = "I'm here to help! ";
      const msg = message.toLowerCase();

      if (msg.includes("register") || msg.includes("join")) {
        fallbackResponse += "To join, click **'Get Started'** at the top of our page. It takes just a few minutes!";
      } else if (msg.includes("500") || msg.includes("1000") || msg.includes("coverage")) {
        fallbackResponse += "Our **2x Coverage** means every KES 500 you contribute gives you KES 1,000 in dental benefits instantly!";
      } else if (msg.includes("branch") || msg.includes("location") || msg.includes("where")) {
        fallbackResponse += "Our Head Office is in **Meru**, and we have branches expanding across Kenya. Contact us for the one nearest to you.";
      } else {
        fallbackResponse += "I'm currently in 'offline mode'. Please reach us on **+254 710 500 500** for detailed assistance.";
      }

      return new Response(JSON.stringify({ response: fallbackResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("[ai-chatbot] Critical Exception:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, // Explicit 500 for errors
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
