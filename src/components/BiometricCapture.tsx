import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Check, AlertCircle, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast"; // Keep useToast for notifications

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
  const { toast } = useToast();

  // Simulate WebAuthn support for UI purposes
  const isSupported = true; 

  const handleCapture = async () => {
    setIsLoading(true);
    setError(null);
    setCaptured(false);
    setVerified(null);

    // Simulate an asynchronous biometric operation
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% chance of success

      if (mode === "register") {
        if (success) {
          const simulatedCredentialId = `simulated_cred_${Date.now()}`;
          setCaptured(true);
          onCaptureComplete?.(simulatedCredentialId);
          toast({
            title: "Biometric Registered Successfully (Simulated)",
            description: "Fingerprint/biometric data has been simulated and captured.",
          });
        } else {
          setError("Simulated capture failed. Please try again.");
          toast({
            title: "Biometric Capture Failed (Simulated)",
            description: "The simulated biometric capture was unsuccessful.",
            variant: "destructive",
          });
        }
      } else if (mode === "verify") {
        if (success) {
          setVerified(true);
          onVerificationComplete?.(true);
          toast({
            title: "Verification Successful (Simulated)",
            description: "Member identity has been verified via simulated biometrics.",
          });
        } else {
          setVerified(false);
          setError("Simulated verification failed. Fingerprint may not match.");
          toast({
            title: "Verification Failed (Simulated)",
            description: "The simulated biometric verification was unsuccessful.",
            variant: "destructive",
          });
        }
      }
      setIsLoading(false);
    }, 2000); // Simulate a 2-second delay
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
            {mode === "register" ? "Fingerprint Registration (Simulated)" : "Fingerprint Verification (Simulated)"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLoading && mode === "register" && "Simulating capture..."}
            {isLoading && mode === "verify" && "Simulating verification..."}
            {!isLoading && mode === "register" && !captured && "Simulate fingerprint capture for secure identification"}
            {!isLoading && mode === "register" && captured && "Fingerprint registered successfully (Simulated)"}
            {!isLoading && mode === "verify" && verified === null && !hasNoBiometricData && "Simulate member identity verification"}
            {!isLoading && mode === "verify" && verified === true && "Identity verified successfully (Simulated)"}
            {!isLoading && mode === "verify" && verified === false && "Fingerprint verification failed (Simulated)"}
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
              {mode === "register" ? "Capturing..." : "Verifying..."}
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
          WebAuthn biometrics requires a compatible device with fingerprint sensor or Windows Hello, 
          and must be accessed via HTTPS.
        </p>
      )}
    </div>
  );
};