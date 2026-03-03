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

  const body = await req.json().catch(() => ({} as any));

  const action = body.action as string | undefined;
  const entityType = (body.entity_type as "member" | "dependant" | "staff" | undefined) || "member";
  const entityId = body.entity_id as string | undefined;
  const template = body.template as string | undefined;
  const format = (body.format as string | undefined) || "iso19794-2";
  const deviceId = (body.device_id as string | undefined) || "unknown-device";
  const captureTs = (body.capture_timestamp as string | undefined) || new Date().toISOString();

  async function getCurrentUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  async function getMemberIdForCurrentUser(): Promise<string | null> {
    const { data } = await supabase
      .from("members")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as any)?.id || null;
  }

  if (!action) {
    return new Response(JSON.stringify({ error: "Missing action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "enroll") {
    if (!template) {
      return new Response(JSON.stringify({ error: "Missing template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentUserId = await getCurrentUserId();
    let targetId = entityId;

    if (!targetId) {
      if (entityType === "member") {
        targetId = await getMemberIdForCurrentUser();
      }
      // For dependant/staff, entity_id is required if not bound to user
    }

    if (!targetId) {
      return new Response(JSON.stringify({ error: "Target entity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist payload
    const payload = {
      biometric_template: template,
      biometric_format: format,
      device_id: deviceId,
      capture_timestamp: captureTs,
      saved_by: currentUserId,
    };

    if (entityType === "member") {
      const json = JSON.stringify(payload);
      const { error: upErr } = await supabase
        .from("members")
        .update({ biometric_data: json, updated_at: new Date().toISOString() })
        .eq("id", targetId);

      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Dependants and staff tables do not have biometric columns in the current schema.
      // Store a secure audit trail so we don't break RLS or schema.
      await supabase.from("system_logs").insert({
        action: "biometric_enrolled",
        details: {
          entity_type: entityType,
          entity_id: targetId,
          ...payload,
        } as any,
      });
    }

    return new Response(JSON.stringify({ success: true, entity_type: entityType, entity_id: targetId }), {
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

    let targetId = entityId;
    if (!targetId && entityType === "member") {
      targetId = await getMemberIdForCurrentUser();
    }
    if (!targetId) {
      return new Response(JSON.stringify({ error: "Target entity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let storedTemplate: string | null = null;

    if (entityType === "member") {
      const { data, error } = await supabase
        .from("members")
        .select("biometric_data")
        .eq("id", targetId)
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        if (data?.biometric_data) {
          const parsed = JSON.parse(data.biometric_data as string);
          storedTemplate = parsed?.biometric_template || parsed?.template || null;
        }
      } catch {
        storedTemplate = null;
      }
    } else {
      // Look up last enrolled template from system logs for dependants/staff
      const { data } = await supabase
        .from("system_logs")
        .select("details")
        .eq("action", "biometric_enrolled")
        .order("created_at", { ascending: false });

      if (Array.isArray(data)) {
        for (const row of data) {
          const details = row.details as any;
          if (details?.entity_type === entityType && details?.entity_id === targetId) {
            storedTemplate = details?.biometric_template || null;
            break;
          }
        }
      }
    }

    // Simple deterministic comparison; production should use vendor/SDK matcher producing a score.
    const match = !!storedTemplate && storedTemplate === template;
    const score = match ? 100 : 0;

    return new Response(JSON.stringify({ match, score }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});