"use client";

import { supabase } from "@/integrations/supabase/client";

export type BiometricFormat = "ansi" | "iso19794-2" | "wsq" | "unknown";

export async function registerExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
  format?: BiometricFormat;
}) {
  const { data, error } = await supabase.functions.invoke("biometric-verify", {
    body: {
      action: "register",
      member_id: params.memberId,
      template: params.templateBase64,
      format: params.format || "unknown",
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to register biometric");
  }
  return data;
}

export async function verifyExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
}) {
  const { data, error } = await supabase.functions.invoke("biometric-verify", {
    body: {
      action: "verify",
      member_id: params.memberId,
      template: params.templateBase64,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to verify biometric");
  }
  return data as { success: boolean };
}