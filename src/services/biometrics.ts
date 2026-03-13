"use client";

import { supabase } from "@/integrations/supabase/client";

export type BiometricFormat = "ansi" | "iso19794-2" | "wsq" | "unknown";

/**
 * Decodes a JWT payload without a library.
 */
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

async function callBiometricFunction(payload: any) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Authentication required. Please log in.");
  }

  const token = session.access_token;
  const jwt = parseJwt(token);

  // DIAGNOSTIC LOGGING
  if (jwt) {
    console.log(`[JWT Diagnostic] This token belongs to project: ${jwt.ref || 'UNKNOWN'}`);
    console.log(`[JWT Diagnostic] Role: ${jwt.role}. Exp: ${new Date(jwt.exp * 1000).toLocaleString()}`);

    if (jwt.ref !== "jjndhaxdxbbupmxiaixk") {
      console.warn(`[JWT ALERT] Token mismatch! Expected jjndhaxdxbbupmxiaixk but got ${jwt.ref}. Clear cookies immediately.`);
    }
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biometric-verify`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    // We use lower-case headers as some proxies prefer them
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': apikey,
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gateway Error] ${response.status}:`, errorText);

      if (response.status === 401) {
        throw new Error("Security Check Failed: The server rejected your login token. Please try an Incognito Window.");
      }

      let errorJson;
      try { errorJson = JSON.parse(errorText); } catch { errorJson = {}; }
      throw new Error(errorJson.error || errorJson.message || `Error ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error("[Network Error]", err);
    throw err;
  }
}

export async function registerExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
  format?: BiometricFormat;
}) {
  return callBiometricFunction({
    action: "register",
    member_id: params.memberId,
    template: params.templateBase64,
    format: params.format || "unknown",
  });
}

export async function verifyExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
}) {
  return callBiometricFunction({
    action: "verify",
    member_id: params.memberId,
    template: params.templateBase64,
  });
}