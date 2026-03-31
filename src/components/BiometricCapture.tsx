import { useState } from "react";
import { Fingerprint, AlertCircle, ShieldCheck, ShieldX, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import ExternalBiometricCapture from "@/components/biometrics/ExternalBiometricCapture";
import FaceBiometricCapture from "@/components/biometrics/FaceBiometricCapture";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
 * BiometricCapture component refactored to support both Fingerprint and Facial recognition.
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
  allowExternal = true,
}: BiometricCaptureProps) => {
  const [captured, setCaptured] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map userId to memberId for backward compatibility
  const effectiveMemberId = memberId || userId;

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs defaultValue="fingerprint" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="fingerprint" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">
            <Fingerprint className="h-4 w-4 mr-2" />
            Fingerprint
          </TabsTrigger>
          <TabsTrigger value="face" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">
            <Camera className="h-4 w-4 mr-2" />
            Face ID
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fingerprint" className="mt-0">
          <div className={cn(
            "p-5 border rounded-xl transition-all shadow-sm",
            captured && "border-green-500 bg-green-50/50 dark:bg-green-950/10",
            verified === true && "border-green-500 bg-green-50/50 dark:bg-green-950/10",
            verified === false && "border-destructive/50 bg-destructive/5",
            !captured && verified === null && "bg-card border-border shadow-md"
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
        </TabsContent>

        <TabsContent value="face" className="mt-0">
          <FaceBiometricCapture
            mode={mode}
            memberId={effectiveMemberId}
            userName={userName}
            onSuccess={() => onVerificationComplete?.(true)}
          />
        </TabsContent>
      </Tabs>
      
      {mode === "verify" && !credentialId && !verified && (
        <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-md border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Note: Ensure the member has biometrics registered before attempting verification.
        </p>
      )}
    </div>
  );
};

