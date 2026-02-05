
// Helper to convert Base64URL to ArrayBuffer
function bufferDecode(value: string): ArrayBuffer {
    return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

// Helper to convert ArrayBuffer to Base64URL
function bufferEncode(value: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(value)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

export async function registerCredential(userId: string, userName: string): Promise<string> {
    // Challenge should ideally come from the server to prevent replay attacks.
    // For this client-heavy implementation without a dedicated auth server for WebAuthn,
    // we generate a random challenge here.
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: "Elephant Care Plan",
            // id: window.location.hostname, // Don't set ID if testing on localhost vs production with different domains initially
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
        authenticatorSelection: {
            authenticatorAttachment: "platform", // Forces built-in authenticator (Fingerprint, FaceID)
            userVerification: "required", // Forces biometric verify
            requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
    };

    const credential = (await navigator.credentials.create({
        publicKey,
    })) as PublicKeyCredential;

    if (!credential) {
        throw new Error("Failed to create credential");
    }

    // We only need to store enough info to identify the credential later.
    // In a full implementation, we'd send the attestationObject to the server.
    // Here we store the credential ID to use in the 'allowCredentials' list during verification.

    return JSON.stringify({
        credentialId: credential.id,
        // In a real backend scenario, we would store public key from response.response.getPublicKey() if available or parse attestation
    });
}

export async function verifyCredential(storedCredentialData: string): Promise<boolean> {
    try {
        const storedData = JSON.parse(storedCredentialData);
        if (!storedData.credentialId) throw new Error("Invalid credential data");

        // Challenge should come from server
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKey: PublicKeyCredentialRequestOptions = {
            challenge,
            allowCredentials: [
                {
                    id: bufferDecode(storedData.credentialId),
                    type: "public-key",
                    transports: ["internal"],
                },
            ],
            userVerification: "required",
            timeout: 60000,
        };

        const assertion = (await navigator.credentials.get({
            publicKey,
        })) as PublicKeyCredential;

        if (!assertion) {
            return false;
        }

        // Use the assertion to verify signature on server.
        // Since we are doing client-side only verification logic (as permitted by the request constraints imply simplistic integration),
        // purely getting the assertion successfully proves the user authenticated with the private key on the device.
        // WARNING: This is less secure than server-side verification but fits the current architecture pattern requested.

        return true;
    } catch (error) {
        console.error("WebAuthn verification error:", error);
        return false;
    }
}
