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
  targetTable?: 'members' | 'dependants';
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
  targetTable = "members",
}: BiometricCaptureProps) => {
  const [captured, setCaptured] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map userId to memberId for backward compatibility
  const effectiveMemberId = memberId || userId;

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("p-1 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800")}>
        <FaceBiometricCapture
          mode={mode}
          memberId={effectiveMemberId}
          userName={userName}
          targetTable={targetTable}
          onSuccess={() => onVerificationComplete?.(true)}
        />
      </div>
      
      {mode === "verify" && !credentialId && !verified && (
        <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-md border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Note: Ensure the {targetTable === 'dependants' ? 'dependant' : 'member'} has Face ID registered before attempting verification.
        </p>
      )}
    </div>
  );
};

