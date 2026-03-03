// Helper to convert Base64URL or Base64 to ArrayBuffer (adds padding if needed)
function bufferDecode(value: string): ArrayBuffer {
    let v = value.trim();

    // If it's base64url, convert to base64
    v = v.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if missing
    const pad = v.length % 4;
    if (pad === 2) v += "==";
    else if (pad === 3) v += "=";
    else if (pad !== 0) v += "=".repeat(4 - pad);

    return Uint8Array.from(atob(v), c => c.charCodeAt(0)).buffer;
}

// Helper to convert ArrayBuffer to Base64URL
function bufferEncode(value: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(value)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

// Extract a credentialId from various stored formats (JSON, raw string, or double-encoded)
function extractCredentialId(input: string): string | null {
    if (!input) return null;
    let s = input.trim();
    if (!s) return null;

    // Try up to 3 times to parse and unwrap nested JSON/string
    for (let i = 0; i < 3; i++) {
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === "object") {
                if (typeof parsed.credentialId === "string" && parsed.credentialId.trim()) {
                    return parsed.credentialId.trim();
                }
                if (typeof parsed.id === "string" && parsed.id.trim()) {
                    return parsed.id.trim();
                }
                if (typeof parsed.rawId === "string" && parsed.rawId.trim()) {
                    return parsed.rawId.trim();
                }
                // If it's an object without the expected keys, stop parsing
                break;
            }
            if (typeof parsed === "string" && parsed.trim()) {
                // Unwrap one layer and continue
                s = parsed.trim();
                continue;
            }
            break;
        } catch {
            // Not JSON; fall through to use raw string
            break;
        }
    }

    // Remove surrounding quotes if present (e.g., "\"...\"")
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }

    return s || null;
}

export async function registerCredential(userId: string, userName: string): Promise<string> {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: "Elephant Care Plan",
            id: window.location.hostname,
        },
        user: {
            id: Uint8Array.from(userId, c => c.charCodeAt(0)),
            name: userName,
            displayName: userName,
        },
        pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
        ],
        // Allow both platform and cross‑platform authenticators
        authenticatorSelection: {
            userVerification: "required",
            // Keep existing resident key preference off for broader compatibility
            requireResidentKey: false,
        },
        timeout: 60000,
        // No attestation needed for this flow
        attestation: "none",
    };

    try {
        const credential = (await navigator.credentials.create({
            publicKey,
        })) as PublicKeyCredential;

        if (!credential) {
            throw new Error("Failed to create credential");
        }

        return JSON.stringify({
            credentialId: credential.id,
        });
    } catch (error: any) {
        if (error.name === "SecurityError") {
            throw new Error("Biometrics are blocked in this environment (likely due to being inside an iframe). Please test the app in a full browser window.");
        }
        throw error;
    }
}

export async function verifyCredential(storedCredentialData: string): Promise<boolean> {
    try {
        const credentialId = extractCredentialId((storedCredentialData ?? "").toString());
        if (!credentialId) {
            throw new Error("Invalid credential data structure");
        }

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKey: PublicKeyCredentialRequestOptions = {
            challenge,
            rpId: window.location.hostname,
            allowCredentials: [
                {
                    id: bufferDecode(credentialId),
                    type: "public-key",
                    // Accept built‑in and external authenticators
                    transports: ["internal", "usb", "ble", "nfc", "hybrid"],
                },
            ],
            userVerification: "required",
            timeout: 60000,
        };

        const assertion = (await navigator.credentials.get({
            publicKey,
        })) as PublicKeyCredential;

        return !!assertion;
    } catch (error: any) {
        console.error("WebAuthn verification error:", error);
        if (error.name === "SecurityError") {
            throw new Error("Biometric verification is blocked in this preview. This feature requires a direct secure connection (HTTPS) and cannot run inside an iframe.");
        }
        throw error;
    }
}