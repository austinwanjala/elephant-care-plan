"use client";

export type BridgeScanResponse = {
  template: string; // base64 ISO/WSQ
  device: string;
  success: boolean;
  format?: "iso19794-2" | "wsq" | "ansi" | "unknown";
  message?: string;
  capture_timestamp?: string;
};

const BRIDGE_URL = "http://localhost:8181/scan";

export async function scanFingerprintViaBridge(params?: {
  source?: "windows" | "external";
  timeoutMs?: number;
}): Promise<BridgeScanResponse> {
  const source = params?.source || "windows";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params?.timeoutMs ?? 8000);

  try {
    const res = await fetch(`${BRIDGE_URL}?source=${encodeURIComponent(source)}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Local bridge error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as BridgeScanResponse;
    if (!json || !json.success || !json.template) {
      throw new Error(json?.message || "Bridge did not return a valid template");
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}