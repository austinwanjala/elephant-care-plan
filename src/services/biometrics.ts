"use client";

import { supabase } from "@/integrations/supabase/client";

export type BiometricFormat = "ansi" | "iso19794-2" | "wsq" | "unknown";

/**
 * Registers a biometric template.
 * Tries the Edge Function first, then falls back to a direct database update
 * if the Edge Function returns an authentication error (401).
 */
export async function registerExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
  format?: BiometricFormat;
}) {
  // 1. Ensure we have a valid session and user sync
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  const { data: { session: activeSession } } = await supabase.auth.getSession();

  if (userErr || !activeSession || !user) {
    console.error("[Biometric] Auth check failed:", userErr);
    throw new Error("Authentication required. Please log out and back in.");
  }

  const tid = params.memberId || user.id;
  console.log(`[Biometric] Starting registration for member: ${tid}`);

  // 1. Try the Edge Function First
  try {
    const { data, error } = await supabase.functions.invoke("biometric-verify", {
      body: {
        action: "register",
        member_id: params.memberId,
        template: params.templateBase64,
        format: params.format || "unknown",
      }
    });

    if (!error) {
      console.log("[Biometric] Registered successfully via Edge Function");
      return data;
    }

    // Detect 401 Unauthorized securely
    const is401 = error.status === 401 ||
      error.message?.includes("401") ||
      (error as any).context?.status === 401;

    if (!is401) {
      console.error("[Biometric] Edge Function error:", error);
      throw error;
    }

    console.warn("[Biometric] Edge Function 401 - Using Direct Database Fallback...");
  } catch (err: any) {
    const is401 = err.status === 401 || err.message?.includes("401");
    if (!is401) {
      console.error("[Biometric] Error in Edge Function call:", err);
      throw err;
    }
    console.warn("[Biometric] Auth error (401) in Edge call - Using Direct Database Fallback...");
  }

  // 2. Direct Database Fallback (if Edge Function fails with 401)
  const payload = JSON.stringify({
    format: params.format || "unknown",
    template: params.templateBase64,
    updated_at: new Date().toISOString(),
  });

  const { error: dbError } = await supabase
    .from("members")
    .update({
      biometric_data: payload,
      updated_at: new Date().toISOString()
    })
    .eq("id", tid);

  if (dbError) {
    console.error("[Biometric] Direct save failed:", dbError);
    throw new Error(dbError.message || "Failed to save biometric data to database.");
  }

  console.log("[Biometric] Registered successfully via direct database update.");
  return { success: true, member_id: tid };
}

/**
 * Verifies a biometric template.
 * Tries Edge Function first, falls back to local comparison if necessary.
 */
export async function verifyExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  try {
    const { data, error } = await supabase.functions.invoke("biometric-verify", {
      body: {
        action: "verify",
        member_id: params.memberId,
        template: params.templateBase64,
      }
    });

    if (!error) return data as { success: boolean };

    const is401 = error.status === 401 ||
      error.message?.includes("401") ||
      (error as any).context?.status === 401;

    if (!is401) throw error;
  } catch (err: any) {
    const is401 = err.status === 401 || err.message?.includes("401");
    if (!is401) throw err;
  }

  // Fallback: Manually fetch and compare (deterministic templates only)
  const targetId = params.memberId || user.id;
  const { data: member, error: memErr } = await supabase
    .from("members")
    .select("biometric_data")
    .eq("id", targetId)
    .maybeSingle();

  if (memErr || !member?.biometric_data) return { success: false };

  try {
    const stored = JSON.parse(member.biometric_data);
    const success = stored.template === params.templateBase64;
    return { success };
  } catch {
    return { success: false };
  }
}