import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { action, member_id, template, format } = await req.json().catch(() => ({}));

  if (!action) {
    return new Response(JSON.stringify({ error: "Missing action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve member id if not provided (current authenticated member)
  async function getMemberId(): Promise<string | null> {
    if (member_id) return member_id as string;
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as any).id as string;
  }

  if (action === "register") {
    if (!template) {
      return new Response(JSON.stringify({ error: "Missing template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mid = await getMemberId();
    if (!mid) {
      return new Response(JSON.stringify({ error: "Member not found for current user" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store as JSON string in members.biometric_data
    const payload = JSON.stringify({
      format: format || "unknown",
      template, // base64 string (ANSI/ISO/WSQ)
      updated_at: new Date().toISOString(),
    });

    const { error: upErr } = await supabase
      .from("members")
      .update({ biometric_data: payload, updated_at: new Date().toISOString() })
      .eq("id", mid);

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, member_id: mid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "verify") {
    if (!template) {
      return new Response(JSON.stringify({ error: "Missing template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mid = await getMemberId();
    if (!mid) {
      return new Response(JSON.stringify({ error: "Member not found for current user" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error: selErr } = await supabase
      .from("members")
      .select("biometric_data")
      .eq("id", mid)
      .maybeSingle();

    if (selErr || !data) {
      return new Response(JSON.stringify({ error: selErr?.message || "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let storedTemplate: string | null = null;
    try {
      if (data.biometric_data) {
        const parsed = JSON.parse(data.biometric_data);
        storedTemplate = parsed?.template || null;
      }
    } catch {
      storedTemplate = null;
    }

    // Simple comparison for now (exact match) — supports deterministic templates
    console.log(`Verifying member: ${mid}`);
    console.log(`Stored template length: ${storedTemplate?.length || 0}`);
    console.log(`Provided template length: ${template.length}`);

    if (storedTemplate && template) {
      console.log(`Stored prefix: ${storedTemplate.substring(0, 50)}...`);
      console.log(`Provided prefix: ${template.substring(0, 50)}...`);
    }

    const success = !!storedTemplate && storedTemplate === template;

    return new Response(JSON.stringify({ success }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});