"use client";

import React, { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Fingerprint, CheckCircle2, XCircle, ScanLine, Cpu, MonitorSmartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { scanFingerprintViaBridge, isBridgeAvailable } from "@/services/biometricBridge";
import { enrollBiometricTemplate, verifyBiometricTemplate } from "@/services/biometrics";

type Mode = "enroll" | "verify";

interface FingerprintCaptureModalProps {
  open: boolean;
  onOpenChange: (val: boolean) => void;
  mode: Mode;
  entityType: "member" | "dependant" | "staff";
  entityId?: string; // optional; if omitted for members, server resolves from auth
  onEnrollComplete?: () => void;
  onVerifyComplete?: (success: boolean) => void;
}

const FingerprintCaptureModal: React.FC<FingerprintCaptureModalProps> = ({
  open,
  onOpenChange,
  mode,
  entityType,
  entityId,
  onEnrollComplete,
  onVerifyComplete,
}) => {
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string>("Ready to scan");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);

  const animateCapture = (phase: "start" | "finger" | "hold" | "done" | "fail") => {
    if (phase === "start") {
      setProgress(10);
      setStatusMsg("Initializing scanner...");
    } else if (phase === "finger") {
      setProgress(40);
      setStatusMsg("Finger detected — hold still…");
    } else if (phase === "hold") {
      setProgress(70);
      setStatusMsg("Capturing… keep finger steady");
    } else if (phase === "done") {
      setProgress(100);
      setStatusMsg("Captured successfully");
    } else if (phase === "fail") {
      setProgress(0);
      setStatusMsg("Capture failed — try again");
    }
  };

  const handleScan = useCallback(
    async (source: "windows" | "external") => {
      setBusy(true);
      setSuccess(null);
      animateCapture("start");

      try {
        const available = await isBridgeAvailable();
        if (!available) {
          throw new Error(
            "Cannot reach the local biometric agent on this PC. Make sure the 'Elephant Biometric Bridge' app is running. If your agent uses a custom port or HTTPS, set VITE_BIOMETRIC_BRIDGE_URL (e.g., http://127.0.0.1:9191/scan) and refresh the app."
          );
        }

        animateCapture("finger");
        const result = await scanFingerprintViaBridge({ source, timeoutMs: 8000 });
        animateCapture("hold");

        if (mode === "enroll") {
          await enrollBiometricTemplate({
            entityType,
            entityId,
            templateBase64: result.template,
            format: (result.format as any) || "iso19794-2",
            deviceId: result.device || (source === "windows" ? "windows-hello" : "external-device"),
            capturedAt: result.capture_timestamp || new Date().toISOString(),
          });
          animateCapture("done");
          setSuccess(true);
          toast({
            title: "Biometric Enrolled",
            description: "Fingerprint template saved successfully.",
          });
          onEnrollComplete?.();
        } else {
          const verify = await verifyBiometricTemplate({
            entityType,
            entityId,
            templateBase64: result.template,
          });
          animateCapture("done");
          setSuccess(verify.match);
          onVerifyComplete?.(verify.match);
          toast({
            title: verify.match ? "Verification Successful" : "Verification Failed",
            description: verify.match ? `Match score: ${verify.score}` : "Fingerprint did not match. Please try again.",
            variant: verify.match ? "default" : "destructive",
          });
        }
      } catch (err: any) {
        animateCapture("fail");
        setSuccess(false);
        toast({
          title: "Capture Error",
          description: err?.message || "Failed to capture fingerprint.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [mode, entityType, entityId, toast, onEnrollComplete, onVerifyComplete]
  );

  const resetStateAndClose = () => {
    setProgress(0);
    setStatusMsg("Ready to scan");
    setSuccess(null);
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fingerprint Capture</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${success === true ? "bg-green-100" : success === false ? "bg-red-100" : "bg-primary/10"} transition-colors`}>
            {success === true ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : success === false ? (
              <XCircle className="w-8 h-8 text-red-600" />
            ) : (
              <Fingerprint className="w-8 h-8 text-primary animate-pulse" />
            )}
          </div>

          <p className="text-sm text-muted-foreground">{statusMsg}</p>

          <div className="w-full">
            <Progress value={progress} />
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <Button
              type="button"
              onClick={() => handleScan("windows")}
              disabled={busy}
              className="flex items-center gap-2"
            >
              <MonitorSmartphone className="w-4 h-4" />
              {mode === "enroll" ? "Scan Fingerprint (Windows Hello)" : "Verify (Windows Hello)"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleScan("external")}
              disabled={busy}
              className="flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              {mode === "enroll" ? "Scan Fingerprint (External Device)" : "Verify (External Device)"}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
            <ScanLine className="w-3 h-3" />
            Live capture uses a local biometric service to return ISO/WSQ templates; OS profiles are not used.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetStateAndClose} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FingerprintCaptureModal;