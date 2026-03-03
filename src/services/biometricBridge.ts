"use client";

export type BridgeScanResponse = {
  template: string; // base64 ISO/WSQ
  device: string;
  success: boolean;
  format?: "iso19794-2" | "wsq" | "ansi" | "unknown";
  message?: string;
  capture_timestamp?: string;
};

const ENV_URL = (import.meta as any)?.env?.VITE_BIOMETRIC_BRIDGE_URL as string | undefined;
const CANDIDATES = Array.from(
  new Set(
    [
      ENV_URL,
      "http://127.0.0.1:8181/scan",
      "http://localhost:8181/scan",
    ].filter(Boolean)
  )
) as string[];

let cachedWorkingUrl: string | null = null;

async function ping(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const u = url.includes("?") ? `${url}&ping=1` : `${url}?ping=1`;
    const res = await fetch(u, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function isBridgeAvailable(timeoutMs: number = 1200): Promise<boolean> {
  if (cachedWorkingUrl) {
    return ping(cachedWorkingUrl, timeoutMs);
  }
  for (const url of CANDIDATES) {
    if (await ping(url, timeoutMs)) {
      cachedWorkingUrl = url;
      return true;
    }
  }
  return false;
}

async function selectBridgeUrl(timeoutMs: number = 1200): Promise<string> {
  if (cachedWorkingUrl && (await ping(cachedWorkingUrl, timeoutMs))) return cachedWorkingUrl;
  for (const url of CANDIDATES) {
    if (await ping(url, timeoutMs)) {
      cachedWorkingUrl = url;
      return url;
    }
  }
  throw new Error("No biometric bridge endpoint responded");
}

export async function scanFingerprintViaBridge(params?: {
  source?: "windows" | "external";
  timeoutMs?: number;
}): Promise<BridgeScanResponse> {
  const source = params?.source || "windows";
  const opTimeout = params?.timeoutMs ?? 8000;

  // Try cached/first good URL, then fall back to the others
  const urlsToTry = cachedWorkingUrl ? [cachedWorkingUrl, ...CANDIDATES.filter(u => u !== cachedWorkingUrl)] : [...CANDIDATES];

  let lastError: any = null;

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opTimeout);
    try {
      const url = baseUrl.includes("?")
        ? `${baseUrl}&source=${encodeURIComponent(source)}`
        : `${baseUrl}?source=${encodeURIComponent(source)}`;
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        lastError = new Error(`Local bridge error: ${res.status} ${res.statusText}`);
      } else {
        const json = (await res.json()) as BridgeScanResponse;
        if (!json || !json.success || !json.template) {
          lastError = new Error(json?.message || "Bridge did not return a valid template");
        } else {
          cachedWorkingUrl = baseUrl;
          clearTimeout(t);
          return json;
        }
      }
    } catch (e) {
      lastError = e;
    } finally {
      // ensure timer cleared
      clearTimeout(t);
    }
  }

  // If we get here, nothing worked
  const details =
    ENV_URL
      ? `Tried ${ENV_URL}, http://127.0.0.1:8181/scan and http://localhost:8181/scan`
      : `Tried http://127.0.0.1:8181/scan and http://localhost:8181/scan`;
  throw new Error(`Cannot reach the local biometric agent. ${details}. Last error: ${lastError?.message || "unknown"}`);
}