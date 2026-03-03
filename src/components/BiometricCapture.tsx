import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Check, AlertCircle, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { registerCredential, verifyCredential } from "@/lib/webauthn";

interface BiometricCaptureProps {
  mode: "register" | "verify";
  userId?: string;
  userName?: string;
  credentialId?: string | null;
  onCaptureComplete?: (credentialData: string) => void;
  onVerificationComplete?: (success: boolean) => void;
  className?: string;
}

export const BiometricCapture = ({
  mode,
  userId,
  userName,
  credentialId,
  onCaptureComplete,
  onVerificationComplete,
  className,
}: BiometricCaptureProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if WebAuthn is supported
    if (window.PublicKeyCredential) {
      setIsSupported(true);
    }
  }, []);

  const handleCapture = async () => {
    setIsLoading(true);
    setError(null);
    setCaptured(false);
    setVerified(null);

    try {
      if (mode === "register") {
        if (!userId || !userName) {
          throw new Error("User details required for registration");
        }

        const credentialData = await registerCredential(userId, userName);

        setCaptured(true);
        onCaptureComplete?.(credentialData);
        toast({
          title: "Biometric Registered Successfully",
          description: "Fingerprint/biometric data has been secured securely.",
        });
      } else if (mode === "verify") {
        if (!credentialId) {
          throw new Error("No biometric data found for this user");
        }

        const isValid = await verifyCredential(credentialId);

        if (isValid) {
          setVerified(true);
          onVerificationComplete?.(true);
          toast({
            title: "Verification Successful",
            description: "Member identity has been verified.",
          });
        } else {
          setVerified(false);
          onVerificationComplete?.(false);
          setError("Verification failed. Fingerprint did not match or was cancelled.");
          toast({
            title: "Verification Failed",
            description: "Biometric verification was unsuccessful.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error("Biometric error:", err);
      const errorMessage = err.message || "An unexpected error occurred";

      setError(errorMessage);
      if (mode === "verify") {
        setVerified(false);
        onVerificationComplete?.(false);
      }

      toast({
        title: mode === "register" ? "Capture Failed" : "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasNoBiometricData = mode === "verify" && !credentialId;

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn(
        "flex items-center gap-4 p-4 border rounded-lg transition-all",
        captured && "border-green-500 bg-green-50 dark:bg-green-950/20",
        verified === true && "border-green-500 bg-green-50 dark:bg-green-950/20",
        verified === false && "border-destructive bg-destructive/10",
        error && !captured && verified === null && "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
        !captured && verified === null && !error && "bg-muted/50"
      )}>
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors",
          captured || verified === true ? "bg-green-100 dark:bg-green-900/30" :
            verified === false ? "bg-destructive/20" :
              "bg-primary/10"
        )}>
          {isLoading ? (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          ) : captured || verified === true ? (
            <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
          ) : verified === false ? (
            <ShieldX className="h-6 w-6 text-destructive" />
          ) : (
            <Fingerprint className="h-6 w-6 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {mode === "register" ? "Fingerprint Registration" : "Fingerprint Verification"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLoading && mode === "register" && "Follow browser prompts..."}
            {isLoading && mode === "verify" && "Verify your identity..."}
            {!isLoading && mode === "register" && !captured && "Securely register your fingerprint/FaceID"}
            {!isLoading && mode === "register" && captured && "Biometric registered successfully"}
            {!isLoading && mode === "verify" && verified === null && !hasNoBiometricData && "Click Verify to confirm identity"}
            {!isLoading && mode === "verify" && verified === true && "Identity verified successfully"}
            {!isLoading && mode === "verify" && verified === false && "Biometric verification failed"}
            {hasNoBiometricData && "No biometric data registered for this member"}
          </p>
          {error && !captured && verified === null && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant={captured || verified === true ? "outline" : hasNoBiometricData ? "secondary" : "default"}
          size="sm"
          onClick={handleCapture}
          disabled={isLoading || captured || verified === true || hasNoBiometricData || !isSupported}
          className={cn(
            captured || verified === true ? "border-green-500 text-green-600" : ""
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              {mode === "register" ? "Waiting..." : "Waiting..."}
            </>
          ) : captured ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Registered
            </>
          ) : verified === true ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Verified
            </>
          ) : verified === false ? (
            "Retry"
          ) : hasNoBiometricData ? (
            "No Data"
          ) : !isSupported ? (
            "Not Supported"
          ) : mode === "register" ? (
            <>
              <Fingerprint className="h-4 w-4 mr-1" />
              Capture
            </>
          ) : (
            <>
              <Fingerprint className="h-4 w-4 mr-1" />
              Verify
            </>
          )}
        </Button>
      </div>

      {!isSupported && (
        <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          WebAuthn biometrics requires a compatible device (Fingerprint/FaceID) and HTTPS context.
        </p>
      )}
    </div>
  );
};