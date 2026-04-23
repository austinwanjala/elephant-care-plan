import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getOfflineResponse(message: string, memberData?: any) {
  let fallbackResponse = memberData 
    ? `Hi ${memberData.full_name.split(' ')[0]}! I'm here to help. ` 
    : "I'm here to help! ";
    
  const msg = (message || "").toLowerCase();

  if (msg.includes("balance") || msg.includes("coverage")) {
    if (memberData) {
        fallbackResponse += `Your current coverage balance is **KES ${memberData.coverage_balance.toLocaleString()}**. `;
        if (memberData.total_contributions > 0) {
            fallbackResponse += `You've contributed a total of KES ${memberData.total_contributions.toLocaleString()} so far. `;
        }
    } else {
        fallbackResponse += "Our **2x Coverage** means every KES 500 you contribute gives you KES 1,000 in dental benefits instantly! Log in to see your specific balance.";
    }
  } else if (msg.includes("register") || msg.includes("join")) {
    fallbackResponse +=
      "To join, click [**'Get Started'**](/register) at the top of our page. It takes just a few minutes!";
  } else if (msg.includes("branch") || msg.includes("location") || msg.includes("where")) {
    fallbackResponse +=
      "Our Head Office is in **Meru**, and we have branches expanding across Kenya. Contact us for the one nearest to you.";
  } else if (msg.includes("contact") || msg.includes("phone") || msg.includes("email")) {
    fallbackResponse +=
      "You can reach us on **+254 710 500 500** or email [**info@elephantdental.org**](mailto:info@elephantdental.org).";
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
    const authHeader = req.headers.get("Authorization");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with service role to bypass RLS for data injection into prompt, 
    // but we use the user's token to identify them.
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let user = null;
    let memberData = null;
    let userRole = null;

    if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user: authUser } } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } }
        }).auth.getUser();
        
        if (authUser) {
            user = authUser;
            // Fetch member data
            const { data: member } = await supabaseClient
                .from("members")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();
            
            memberData = member;

            // Fetch role
            const { data: roleData } = await supabaseClient
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .maybeSingle();
            
            userRole = roleData?.role;
        }
    }

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

    let systemPrompt = `You are "Effie", the Elephant Dental Assistant. You are a friendly, helpful, and professional AI.
Context: Elephant Dental is a modern dental health provider in Kenya.
Core Offer: "2x Coverage" - Pay KES 500, get KES 1,000 coverage.
Minimum: KES 500.
Registration: 1. Register, 2. Pay via M-Pesa STK Push, 3. Get Digital Card (QR code).
Branches: Head Office in Meru, expanding nationwide.
Contact: +254 710 500 500, info@elephantdental.org.
Tone: Professional, welcoming.
Rules: Stay on topic (dental care/membership). Be concise. Use bolding for emphasis.`;

    if (memberData) {
        systemPrompt += `\n\nUser Context:
Current User Name: ${memberData.full_name}
Member Number: ${memberData.member_number}
Coverage Balance: KES ${memberData.coverage_balance}
Total Contributions: KES ${memberData.total_contributions}
Phone: ${memberData.phone}
Status: ${memberData.is_active ? 'Active' : 'Inactive'}

You should greet the user by their first name and you can answer questions about their balance or account directly.`;
    } else if (userRole === 'admin' || userRole === 'staff') {
        systemPrompt += `\n\nUser Context:
The current user is a ${userRole}. They have access to administrative or staff functions. Help them with system-related queries.`;
    }

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
      JSON.stringify({ response: getOfflineResponse(message, memberData), mode: "offline" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ai-chatbot] Critical Exception:", msg);
    return new Response(
      JSON.stringify({ response: "I encountered a problem. How else can I help?", mode: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});