"use client";

import { supabase } from "@/integrations/supabase/client";

export type BiometricFormat = "ansi" | "iso19794-2" | "wsq" | "unknown";

export async function registerExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
  format?: BiometricFormat;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("DEBUG: registerExternalBiometric triggered. Session check status:", !!session);
  if (!session) {
    console.warn("DEBUG: No session found!");
    throw new Error("You must be logged in to perform biometric actions.");
  }
  
  const token = session.access_token;
  console.log(`DEBUG: Token detected. Length: ${token.length}. Prefix: ${token.substring(0, 10)}... Suffix: ...${token.substring(token.length - 10)}`);


  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  console.log(`DEBUG: API Key prefix: ${apiKey?.substring(0, 10)}...`);

  const { data, error } = await supabase.functions.invoke("biometric-verify", {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "apikey": apiKey,
    },
    body: {
      action: "register",
      member_id: params.memberId,
      template: params.templateBase64,
      format: params.format || "unknown",
    },
  });

  if (error) {
    console.error("DEBUG: registerExternalBiometric error object:", JSON.stringify(error));
    throw new Error(error.message || "Failed to register biometric");
  }
  return data;
}

export async function verifyExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be logged in to perform biometric actions.");
  }

  const token = session.access_token;
  console.log(`DEBUG: Token detected (Verify). Length: ${token.length}. Prefix: ${token.substring(0, 10)}... Suffix: ...${token.substring(token.length - 10)}`);


  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  console.log(`DEBUG: API Key prefix (Verify): ${apiKey?.substring(0, 10)}...`);

  const { data, error } = await supabase.functions.invoke("biometric-verify", {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "apikey": apiKey,
    },
    body: {
      action: "verify",
      member_id: params.memberId,
      template: params.templateBase64,
    },
  });

  if (error) {
    console.error("DEBUG: verifyExternalBiometric error object:", JSON.stringify(error));
    throw new Error(error.message || "Failed to verify biometric");
  }
  return data as { success: boolean };
}