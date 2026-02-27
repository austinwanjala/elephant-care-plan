import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getOfflineResponse(message: string) {
  let fallbackResponse = "I'm here to help! ";
  const msg = (message || "").toLowerCase();

  if (msg.includes("register") || msg.includes("join")) {
    fallbackResponse +=
      "To join, click **'Get Started'** at the top of our page. It takes just a few minutes!";
  } else if (msg.includes("500") || msg.includes("1000") || msg.includes("coverage")) {
    fallbackResponse +=
      "Our **2x Coverage** means every KES 500 you contribute gives you KES 1,000 in dental benefits instantly!";
  } else if (msg.includes("branch") || msg.includes("location") || msg.includes("where")) {
    fallbackResponse +=
      "Our Head Office is in **Meru**, and we have branches expanding across Kenya. Contact us for the one nearest to you.";
  } else if (msg.includes("contact") || msg.includes("phone") || msg.includes("email")) {
    fallbackResponse +=
      "You can reach us on **+254 710 500 500** or email **info@elephantdental.org**.";
  } else {
    fallbackResponse +=
      "Please tell me what you need help with (registration, coverage, branches, or payments).";
  }

  return fallbackResponse;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jsonBody = await req.json().catch(() => ({}));
    const { message, history = [] } = jsonBody;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({
          response: "Please type a question so I can help.",
          mode: "validation",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeHistory = Array.isArray(history)
      ? history
        .filter(
          (h: any) =>
            h &&
            typeof h.content === "string" &&
            (h.role === "user" || h.role === "assistant")
        )
        .slice(-12)
      : [];

    const systemPrompt = `You are "Effie", the Elephant Dental Assistant. You are a friendly, helpful, and professional AI.
Context: Elephant Dental is a modern dental health provider in Kenya.
Core Offer: "2x Coverage" - Pay KES 500, get KES 1,000 coverage.
Minimum: KES 500.
Registration: 1. Register, 2. Pay via M-Pesa STK Push, 3. Get Digital Card (QR code).
Branches: Head Office in Meru, expanding nationwide.
Contact: +254 710 500 500, info@elephantdental.org.
Tone: Professional, welcoming.
Rules: Stay on topic (dental care/membership). Be concise. Use bolding for emphasis.`;

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (openAiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              ...safeHistory.map((h: any) => ({ role: h.role, content: h.content })),
              { role: "user", content: message },
            ],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error(
            "[ai-chatbot] OpenAI Error Response:",
            JSON.stringify(errorData)
          );
          throw new Error(errorData?.error?.message || response.statusText);
        }

        const data = await response.json();
        const aiResponse =
          data.choices?.[0]?.message?.content ||
          "I'm sorry, I couldn't generate a response.";

        return new Response(
          JSON.stringify({ response: aiResponse, mode: "openai" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[ai-chatbot] OpenAI failed, using offline fallback", { msg });
      }
    }

    // Offline fallback
    return new Response(
      JSON.stringify({ response: getOfflineResponse(message), mode: "offline" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ai-chatbot] Critical Exception:", msg);
    return new Response(
      JSON.stringify({ response: getOfflineResponse(""), mode: "offline" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});