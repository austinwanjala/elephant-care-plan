"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Fingerprint, CheckCircle2, XCircle, ScanLine, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const [supportsHID, setSupportsHID] = useState(false);
  const [supportsUSB, setSupportsUSB] = useState(false);

  useEffect(() => {
    setSupportsHID(Boolean((navigator as any).hid));
    setSupportsUSB(Boolean((navigator as any).usb));
  }, []);

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

  // Convert DataView/ArrayBuffer to base64 string
  const toBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const processTemplate = async (templateBase64: string, deviceId: string, format: "iso19794-2" | "wsq" | "ansi" | "unknown" = "unknown") => {
    // Enroll or verify using our Supabase function
    if (mode === "enroll") {
      await enrollBiometricTemplate({
        entityType,
        entityId,
        templateBase64,
        format,
        deviceId,
        capturedAt: new Date().toISOString(),
      });
      animateCapture("done");
      setSuccess(true);
      toast({ title: "Biometric Enrolled", description: "Fingerprint template saved successfully." });
      onEnrollComplete?.();
    } else {
      const resp = await verifyBiometricTemplate({
        entityType,
        entityId,
        templateBase64,
      });
      animateCapture("done");
      setSuccess(resp.match);
      toast({
        title: resp.match ? "Verification Successful" : "Verification Failed",
        description: resp.match ? `Match score: ${resp.score}` : "Fingerprint did not match. Please try again.",
        variant: resp.match ? "default" : "destructive",
      });
      onVerifyComplete?.(resp.match);
    }
  };

  // WebHID: read input report and use as template (vendor devices may already output ISO/WSQ)
  const captureViaHID = useCallback(async () => {
    setBusy(true);
    setSuccess(null);
    animateCapture("start");
    try {
      if (!supportsHID) throw new Error("WebHID is not supported in this browser.");
      animateCapture("finger");
      const navAny = navigator as any;
      const devices: HIDDevice[] = await navAny.hid.requestDevice({ filters: [] });
      if (!devices || devices.length === 0) throw new Error("No HID device selected.");
      const device = devices[0];
      await device.open();
      animateCapture("hold");

      const templateP = new Promise<string>((resolve, reject) => {
        const onReport = (e: HIDInputReportEvent) => {
          try {
            const dataView = e.data;
            const base64 = toBase64(dataView.buffer.slice(0));
            device.removeEventListener("inputreport", onReport as any);
            resolve(base64);
          } catch (err) {
            device.removeEventListener("inputreport", onReport as any);
            reject(err);
          }
        };
        device.addEventListener("inputreport", onReport as any);
      });

      const base64 = await templateP;
      await processTemplate(base64, device.productName || "hid-device", "unknown");
    } catch (err: any) {
      animateCapture("fail");
      setSuccess(false);
      toast({
        title: "HID Capture Error",
        description: err?.message || "Failed to read from HID device.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [supportsHID, mode, entityType, entityId]);

  // WebUSB: read a vendor endpoint (many scanners expose vendor-specific control/bulk endpoints)
  const captureViaUSB = useCallback(async () => {
    setBusy(true);
    setSuccess(null);
    animateCapture("start");
    try {
      if (!supportsUSB) throw new Error("WebUSB is not supported in this browser.");
      animateCapture("finger");
      const navAny = navigator as any;
      const device: USBDevice = await navAny.usb.requestDevice({ filters: [] });
      if (!device) throw new Error("No USB device selected.");
      await device.open();
      if (!device.configuration) await device.selectConfiguration(1);
      await device.claimInterface(0);
      animateCapture("hold");

      // Generic read; for real devices you would use the vendor protocol
      const result = await device.controlTransferIn(
        { requestType: "vendor", recipient: "device", request: 1, value: 0x0000, index: 0x0000 },
        4096
      );
      if (!result || !result.data) throw new Error("No data received from USB device.");
      const base64 = toBase64(result.data.buffer);
      await processTemplate(base64, device.productName || "usb-device", "unknown");
    } catch (err: any) {
      animateCapture("fail");
      setSuccess(false);
      toast({
        title: "USB Capture Error",
        description: err?.message || "Failed to read from USB device.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [supportsUSB, mode, entityType, entityId]);

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
              onClick={captureViaHID}
              disabled={busy || !supportsHID}
              className="flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              {mode === "enroll" ? "Scan via WebHID" : "Verify via WebHID"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={captureViaUSB}
              disabled={busy || !supportsUSB}
              className="flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              {mode === "enroll" ? "Scan via WebUSB" : "Verify via WebUSB"}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
            <ScanLine className="w-3 h-3" />
            Live capture uses connected USB/HID fingerprint readers. OS-stored biometrics are not used.
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