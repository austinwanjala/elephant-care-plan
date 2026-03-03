"use client";

import { supabase } from "@/integrations/supabase/client";

export type BiometricFormat = "ansi" | "iso19794-2" | "wsq" | "unknown";

export async function enrollBiometricTemplate(params: {
  entityType: "member" | "dependant" | "staff";
  entityId?: string;
  templateBase64: string;
  format?: BiometricFormat;
  deviceId?: string;
  capturedAt?: string;
}) {
  const { data, error } = await supabase.functions.invoke("biometric-verify", {
    body: {
      action: "enroll",
      entity_type: params.entityType,
      entity_id: params.entityId,
      template: params.templateBase64,
      format: params.format || "iso19794-2",
      device_id: params.deviceId || "unknown-device",
      capture_timestamp: params.capturedAt || new Date().toISOString(),
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to enroll biometric");
  }
  return data;
}

export async function verifyBiometricTemplate(params: {
  entityType: "member" | "dependant" | "staff";
  entityId?: string;
  templateBase64: string;
}) {
  const { data, error } = await supabase.functions.invoke("biometric-verify", {
    body: {
      action: "verify",
      entity_type: params.entityType,
      entity_id: params.entityId,
      template: params.templateBase64,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to verify biometric");
  }
  return data as { match: boolean; score: number };
}