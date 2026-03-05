"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Cpu, Fingerprint, Upload, Usb, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerExternalBiometric, verifyExternalBiometric, BiometricFormat } from "@/services/biometrics";

type Mode = "register" | "verify";

interface ExternalBiometricCaptureProps {
  mode: Mode;
  memberId?: string;
  onRegistered?: (templateBase64: string) => void;
  onVerified?: (success: boolean) => void;
  className?: string;
  maxDurationMs?: number; // default 5000
}

const toBase64 = async (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

export default function ExternalBiometricCapture({
  mode,
  memberId,
  onRegistered,
  onVerified,
  className,
  maxDurationMs = 5000,
}: ExternalBiometricCaptureProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [supportsHID, setSupportsHID] = useState(false);
  const [supportsUSB, setSupportsUSB] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setSupportsHID(!!(navigator as any).hid);
    setSupportsUSB(!!(navigator as any).usb);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const finishWithTimeout = (promise: Promise<any>) =>
    Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timeoutRef.current = window.setTimeout(() => reject(new Error("Capture timed out")), maxDurationMs);
      }),
    ]);

  const handleRegister = async (templateBase64: string, format: BiometricFormat = "unknown") => {
    if (mode !== "register") return;
    const resp = await registerExternalBiometric({ memberId, templateBase64, format });
    onRegistered?.(templateBase64);
    toast({ title: "Biometric Registered", description: "Template stored successfully." });
    setStatus("Biometric registered successfully");
    return resp;
  };

  const handleVerify = async (templateBase64: string) => {
    if (mode !== "verify") return;
    const resp = await verifyExternalBiometric({ memberId, templateBase64 });
    onVerified?.(resp.success);
    setStatus(resp.success ? "Verification successful" : "Verification failed");
    toast({
      title: resp.success ? "Verification Successful" : "Verification Failed",
      description: resp.success ? "Identity confirmed." : "Biometric template did not match.",
      variant: resp.success ? "default" : "destructive",
    });
    return resp;
  };

  const processTemplate = async (templateBase64: string, format: BiometricFormat = "unknown") => {
    if (mode === "register") return handleRegister(templateBase64, format);
    return handleVerify(templateBase64);
  };

  const captureViaHID = useCallback(async () => {
    if (!supportsHID) {
      toast({ title: "HID Not Supported", description: "This browser does not support WebHID.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setStatus("Waiting for HID device input...");
    try {
      const navAny = navigator as any;
      const devices: HIDDevice[] = await navAny.hid.requestDevice({ filters: [] });
      if (!devices || devices.length === 0) throw new Error("No HID device selected");
      const device = devices[0];
      await device.open();

      const templateP = new Promise<string>((resolve, reject) => {
        const onReport = (e: HIDInputReportEvent) => {
          try {
            // Convert report data to base64; vendor-specific decoding is outside scope
            const dataView = e.data;
            const bytes = new Uint8Array(dataView.buffer.slice(0));
            if (bytes.byteLength === 0) return; // wait for real data
            const bin = Array.from(bytes)
              .map((b) => String.fromCharCode(b))
              .join("");
            const base64 = btoa(bin);
            device.removeEventListener("inputreport", onReport as any);
            resolve(base64);
          } catch (err) {
            device.removeEventListener("inputreport", onReport as any);
            reject(err);
          }
        };
        device.addEventListener("inputreport", onReport as any);
      });

      const base64 = (await finishWithTimeout(templateP)) as string;
      await processTemplate(base64, "unknown");
    } catch (err: any) {
      let msg = err.message || "Failed to read from device.";
      if (err.name === "SecurityError" || msg.toLowerCase().includes("access denied")) {
        msg = "Access Denied: The device is locked by another program or requires higher permissions. Try unplugging and replugging the device.";
      }
      toast({ title: "HID Capture Failed", description: msg, variant: "destructive" });
      setStatus("HID capture failed: " + msg);
    } finally {
      setBusy(false);
    }
  }, [supportsHID, maxDurationMs, mode]);

  const captureViaUSB = useCallback(async () => {
    if (!supportsUSB) {
      toast({ title: "USB Not Supported", description: "This browser does not support WebUSB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setStatus("Connecting to USB device...");
    try {
      const navAny = navigator as any;
      const device: USBDevice = await navAny.usb.requestDevice({ filters: [] });
      if (!device) throw new Error("No USB device selected");
      await device.open();
      if (device.configuration == null) await device.selectConfiguration(1);
      // Attempt to claim first interface; vendor implementations vary
      await device.claimInterface(0);

      // Try a generic control transfer to read a small block (vendor-specific in reality)
      const result = await finishWithTimeout(
        device.controlTransferIn({ requestType: "vendor", recipient: "device", request: 1, value: 0x0000, index: 0x0000 }, 512) as any
      ) as USBInTransferResult;

      if (!result || !result.data) throw new Error("No data received from USB device");

      const bytes = new Uint8Array(result.data.buffer.slice(0));
      const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
      const base64 = btoa(bin);

      await processTemplate(base64, "unknown");
    } catch (err: any) {
      let msg = err.message || "Vendor-specific USB command not supported by this device.";
      if (err.name === "SecurityError" || msg.toLowerCase().includes("access denied")) {
        msg = "Access Denied: The device is in use or requires a WinUSB driver. On Windows, use Zadig to switch the driver to 'WinUSB' for this device.";
      }
      toast({
        title: "USB Capture Failed",
        description: msg,
        variant: "destructive",
      });
      setStatus("USB capture failed: " + msg);
    } finally {
      setBusy(false);
    }
  }, [supportsUSB, maxDurationMs, mode]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setStatus("Processing template...");
    try {
      const base64 = await finishWithTimeout(toBase64(file)) as string;
      let format: BiometricFormat = "unknown";
      const ext = file.name.toLowerCase();
      if (ext.endsWith(".wsq")) format = "wsq";
      if (ext.endsWith(".ansi") || ext.endsWith(".ansi378") || ext.endsWith(".ansi-378")) format = "ansi";
      if (ext.endsWith(".iso") || ext.endsWith(".iso19794") || ext.endsWith(".iso19794-2")) format = "iso19794-2";
      await processTemplate(base64, format);
    } catch (err: any) {
      toast({ title: "Template Import Failed", description: err.message || "Could not read file.", variant: "destructive" });
      setStatus("Template import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <Fingerprint className="h-4 w-4" />
          {mode === "register" ? "Register biometric from external device" : "Verify via external device"}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button type="button" variant="secondary" onClick={captureViaHID} disabled={!supportsHID || busy} className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            WebHID
          </Button>
          <Button type="button" variant="secondary" onClick={captureViaUSB} disabled={!supportsUSB || busy} className="flex items-center gap-2">
            <Usb className="h-4 w-4" />
            WebUSB
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="biometric-file" className="sr-only">Template file</Label>
            <Input
              id="biometric-file"
              type="file"
              accept=".wsq,.ansi,.ansi378,.iso,.iso19794,.iso19794-2"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Wifi className="h-3 w-3" />
          Supports Windows Hello compatible readers, HID-compliant scanners, or vendor SDK export (WSQ/ANSI/ISO).
        </div>

        {status && (
          <div className={cn(
            "text-xs flex items-start gap-1 p-2 rounded",
            status.toLowerCase().includes("failed") ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
          )}>
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{status}</span>
          </div>
        )}

        {status?.toLowerCase().includes("access denied") && (
          <div className="text-[10px] bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
            <strong>Pro Tip:</strong> If you're on Windows and see 'Access Denied', your reader likely needs the <strong>WinUSB</strong> driver. Use a tool like <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Zadig</a> to replace the current driver with WinUSB, then refresh this page.
          </div>
        )}
      </div>
    </div>
  );
}