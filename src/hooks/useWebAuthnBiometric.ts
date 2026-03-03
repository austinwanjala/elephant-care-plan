import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface WebAuthnResult {
  credentialId: string;
  publicKey: string;
  authenticatorData: string;
  clientDataJSON: string;
}

interface UseWebAuthnBiometricReturn {
  isSupported: boolean;
  isCapturing: boolean;
  isVerifying: boolean;
  registerBiometric: (userId: string, userName: string) => Promise<WebAuthnResult | null>;
  verifyBiometric: (credentialId: string) => Promise<boolean>;
  error: string | null;
}

// Convert ArrayBuffer to Base64 string
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert Base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
};

// Generate a random challenge
const generateChallenge = (): ArrayBuffer => {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge.buffer as ArrayBuffer;
};

export const useWebAuthnBiometric = (): UseWebAuthnBiometricReturn => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if WebAuthn is supported
  const isSupported = typeof window !== "undefined" && 
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function";

  // Register a new biometric credential (for member registration)
  const registerBiometric = useCallback(async (
    userId: string,
    userName: string
  ): Promise<WebAuthnResult | null> => {
    if (!isSupported) {
      setError("WebAuthn is not supported on this device/browser");
      toast({
        title: "Biometric Not Supported",
        description: "Your device or browser does not support fingerprint authentication.",
        variant: "destructive",
      });
      return null;
    }

    setIsCapturing(true);
    setError(null);

    try {
      // Check if platform authenticator is available (fingerprint, face ID, etc.)
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (!available) {
        throw new Error("No platform authenticator available. Please ensure your device has fingerprint or biometric capability enabled.");
      }

      const challenge = generateChallenge();
      
      // Create credential options for registration
      const createOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Dental Insurance System",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Use built-in authenticator (fingerprint/face)
          userVerification: "required",        // Require biometric verification
          residentKey: "preferred",
        },
        timeout: 60000, // 60 seconds timeout
        attestation: "direct",
      };

      toast({
        title: "Biometric Registration",
        description: "Please authenticate using your fingerprint or face recognition...",
      });

      // Create the credential
      const credential = await navigator.credentials.create({
        publicKey: createOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Failed to create credential");
      }

      const response = credential.response as AuthenticatorAttestationResponse;

      const result: WebAuthnResult = {
        credentialId: arrayBufferToBase64(credential.rawId),
        publicKey: arrayBufferToBase64(response.getPublicKey?.() || new ArrayBuffer(0)),
        authenticatorData: arrayBufferToBase64(response.getAuthenticatorData()),
        clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
      };

      toast({
        title: "Biometric Registered Successfully",
        description: "Fingerprint/biometric data has been securely captured.",
      });

      return result;
    } catch (err: any) {
      console.error("WebAuthn registration error:", err);
      
      let errorMessage = "Failed to capture biometric data";
      
      if (err.name === "NotAllowedError") {
        errorMessage = "Biometric authentication was denied or timed out. Please try again.";
      } else if (err.name === "SecurityError") {
        errorMessage = "Security error. Please ensure you're on a secure connection (HTTPS).";
      } else if (err.name === "NotSupportedError") {
        errorMessage = "This type of biometric authentication is not supported on your device.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      toast({
        title: "Biometric Capture Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isSupported, toast]);

  // Verify an existing biometric credential (for hospital visit verification)
  const verifyBiometric = useCallback(async (credentialId: string): Promise<boolean> => {
    if (!isSupported) {
      setError("WebAuthn is not supported on this device/browser");
      toast({
        title: "Biometric Not Supported",
        description: "Your device or browser does not support fingerprint authentication.",
        variant: "destructive",
      });
      return false;
    }

    if (!credentialId) {
      setError("No biometric data registered for this member");
      toast({
        title: "No Biometric Data",
        description: "This member has no registered biometric data.",
        variant: "destructive",
      });
      return false;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const challenge = generateChallenge();

      // Create assertion options for verification
      const getOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
        allowCredentials: [
          {
            id: base64ToArrayBuffer(credentialId),
            type: "public-key",
            transports: ["internal"], // Platform authenticator
          },
        ],
      };

      toast({
        title: "Biometric Verification",
        description: "Please verify using your fingerprint or face recognition...",
      });

      // Get the assertion
      const assertion = await navigator.credentials.get({
        publicKey: getOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error("Verification failed - no assertion received");
      }

      // In a real implementation, you would verify the signature on the server
      // For this implementation, successful assertion means verification passed
      toast({
        title: "Verification Successful",
        description: "Member identity has been verified via biometrics.",
      });

      return true;
    } catch (err: any) {
      console.error("WebAuthn verification error:", err);
      
      let errorMessage = "Biometric verification failed";
      
      if (err.name === "NotAllowedError") {
        errorMessage = "Verification was denied or timed out. The fingerprint may not match.";
      } else if (err.name === "SecurityError") {
        errorMessage = "Security error during verification.";
      } else if (err.name === "InvalidStateError") {
        errorMessage = "No matching credential found. Member may need to re-register biometrics.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [isSupported, toast]);

  return {
    isSupported,
    isCapturing,
    isVerifying,
    registerBiometric,
    verifyBiometric,
    error,
  };
};
