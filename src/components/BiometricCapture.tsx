import { useState } from "react";
import { Fingerprint, AlertCircle, ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import ExternalBiometricCapture from "@/components/biometrics/ExternalBiometricCapture";

interface BiometricCaptureProps {
  mode: "register" | "verify";
  userId?: string;
  userName?: string;
  credentialId?: string | null;
  onCaptureComplete?: (credentialData: string) => void;
  onVerificationComplete?: (success: boolean) => void;
  className?: string;
  memberId?: string;
  allowExternal?: boolean;
}

/**
 * BiometricCapture component refactored to use direct fingerprint capture.
 * WebAuthn dependencies have been removed in favor of direct HID/USB scanner access.
 */
export const BiometricCapture = ({
  mode,
  userId,
  userName,
  credentialId,
  onCaptureComplete,
  onVerificationComplete,
  className,
  memberId,
  allowExternal = true, // Redundant now but kept for compatibility
}: BiometricCaptureProps) => {
  const [captured, setCaptured] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map userId to memberId for backward compatibility
  const effectiveMemberId = memberId || userId;

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn(
        "p-5 border rounded-xl transition-all shadow-sm",
        captured && "border-green-500 bg-green-50/50 dark:bg-green-950/10",
        verified === true && "border-green-500 bg-green-50/50 dark:bg-green-950/10",
        verified === false && "border-destructive/50 bg-destructive/5",
        !captured && verified === null && "bg-card border-border"
      )}>
        <div className="flex items-center gap-4 mb-4">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all",
            captured || verified === true ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
            verified === false ? "bg-destructive/10 text-destructive" :
            "bg-primary/10 text-primary"
          )}>
            {captured || verified === true ? (
              <ShieldCheck className="h-6 w-6" />
            ) : verified === false ? (
              <ShieldX className="h-6 w-6" />
            ) : (
              <Fingerprint className="h-6 w-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              {mode === "register" ? "Fingerprint Registration" : "Fingerprint Verification"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {captured ? "Template captured and registered" : 
               verified === true ? "Identity verified successfully" :
               verified === false ? "Verification failed" :
               mode === "register" ? `Securely register fingerprint for ${userName || 'the member'}` : "Verify identity using an external scanner"}
            </p>
          </div>
        </div>

        <div className="border-t pt-4 border-dashed">
          <ExternalBiometricCapture
            mode={mode}
            memberId={effectiveMemberId}
            credentialId={credentialId}
            onRegistered={(template) => {
              setCaptured(true);
              setVerified(null);
              setError(null);
              onCaptureComplete?.(template);
            }}
            onVerified={(success) => {
              setVerified(success);
              setCaptured(false);
              setError(success ? null : "Identity verification failed. Please try again.");
              onVerificationComplete?.(success);
            }}
            className="mt-1"
          />
        </div>

        {error && !verified && (
          <div className="mt-3 p-2 bg-destructive/10 text-destructive rounded-md text-[11px] flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
      {mode === "verify" && !credentialId && !verified && (
        <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-md border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Note: No existing biometric data found for this member. A successful scan will be compared against the server.
        </p>
      )}
    </div>
  );
};