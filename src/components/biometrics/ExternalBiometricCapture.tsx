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

  const finishWithTimeout = (promise: Promise<any>, timeoutMs?: number) =>
    Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timeoutRef.current = window.setTimeout(() => reject(new Error("Capture timed out. Please try again and ensure your finger is on the scanner.")), timeoutMs || maxDurationMs);
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

      setStatus("HID Device opened. Attempting to power on sensor...");
      console.log("Device Info:", { vendorId: device.vendorId, productId: device.productId, productName: device.productName });

      // Attempt multiple common HID activation sequences
      const activationAttempts = async () => {
        try {
          // Attempt 1: Standard Output Report (0x01)
          await device.sendReport(0x01, new Uint8Array([0x01, 0x01]));
        } catch (e) {
          try {
            // Attempt 2: Alternative Report ID (0x02)
            await device.sendReport(0x02, new Uint8Array([0x01]));
          } catch (e2) {
            try {
              // Attempt 3: Feature Report (sometimes used for power-on)
              await device.setFeatureReport(0x01, new Uint8Array([0x01]));
            } catch (e3) {
              console.warn("All activation commands failed. The device may require a specific vendor command.");
            }
          }
        }
      };

      await activationAttempts();
      setStatus("Scanner ready. If the light is NOT on, your device might require a local Windows driver or service (like RD Service).");

      const templateP = new Promise<string>((resolve, reject) => {
        const onReport = (e: HIDInputReportEvent) => {
          try {
            // Convert report data to base64; vendor-specific decoding is outside scope
            const dataView = e.data;
            const bytes = new Uint8Array(dataView.buffer.slice(0));
            if (bytes.byteLength < 10) return; // Ignore small/empty reports (status updates)
            setStatus("Data received, processing...");
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
        msg = "Access Denied: This HID device is protected by Windows. If this is a Windows Hello reader, please use the main 'Capture' button above instead of 'External'.";
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

      setStatus("USB Device found. Opening connection...");
      await device.open();

      // Log details to help developer identify the reader
      console.log("Device Connected:", {
        name: device.productName,
        vendorId: device.vendorId,
        productId: device.productId,
        classes: device.configuration?.interfaces.map(i => i.alternates[0].interfaceClass)
      });

      // Attempt to reset the device state (helps power on some readers)
      try { await device.reset(); } catch (e) { console.warn("Reset failed, continuing..."); }

      if (device.configuration == null) await device.selectConfiguration(1);

      // Try to claim the first available interface, or iterate if 0 is blocked
      let interfaceNum = 0;
      try {
        await device.claimInterface(0);
      } catch (e) {
        console.warn("Interface 0 busy, trying Interface 1...");
        interfaceNum = 1;
        await device.claimInterface(1);
      }

      // Start command (0x01) - some readers also need 0x12 for 'Power On'
      try {
        await device.controlTransferOut({
          requestType: 'vendor', recipient: 'device', request: 0x01, value: 0x0000, index: interfaceNum
        });
        await device.controlTransferOut({
          requestType: 'vendor', recipient: 'device', request: 0x12, value: 0x0000, index: interfaceNum
        });
      } catch (e) { }

      setStatus("Scanner activated. LED should be ON now. Please scan...");

      // Look for data endpoints
      const alt = device.configuration?.interfaces[interfaceNum]?.alternates[0];
      const endpointIn = alt?.endpoints.find(e => e.direction === 'in');

      let bytes: Uint8Array = new Uint8Array(0);
      const startTime = Date.now();
      const timeoutLimit = maxDurationMs > 5000 ? maxDurationMs : 15000; // Give at least 15s for USB

      // Loop to poll for data if it's not a blocking bulk transfer
      // or if the first read returns status bytes instead of the template
      while (bytes.length < 100 && (Date.now() - startTime < timeoutLimit)) {
        let result: USBInTransferResult;

        if (endpointIn) {
          // Attempt to read from Bulk/Interrupt endpoint
          result = await finishWithTimeout(device.transferIn(endpointIn.endpointNumber, 1024 * 16), timeoutLimit) as USBInTransferResult;
        } else {
          // Fallback to control transfer
          result = await finishWithTimeout(
            device.controlTransferIn({ requestType: "vendor", recipient: "device", request: 1, value: 0x0000, index: 0x0000 }, 2048),
            timeoutLimit
          ) as USBInTransferResult;
        }

        if (result && result.data && result.data.byteLength >= 100) {
          bytes = new Uint8Array(result.data.buffer.slice(0));
          break;
        }

        // Short pause before retry if we got too little data
        await new Promise(r => setTimeout(r, 500));
        setStatus(`Waiting for scan... (${Math.round((timeoutLimit - (Date.now() - startTime)) / 1000)}s)`);
      }

      if (bytes.length < 100) {
        throw new Error("Capture timed out or data too small. Please ensure you hold your finger on the scanner until capture is complete.");
      }

      setStatus("Template captured successfully!");
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
  }, [supportsUSB, maxDurationMs, processTemplate, toast]);

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
          <Button
            type="button"
            variant="default"
            onClick={captureViaHID}
            disabled={!supportsHID || busy}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-md ring-2 ring-blue-400/20"
          >
            <Cpu className="h-4 w-4" />
            WebHID (Primary)
          </Button>
          <Button type="button" variant="secondary" onClick={captureViaUSB} disabled={!supportsUSB || busy} className="flex items-center gap-2 border border-slate-200">
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

        {status?.toLowerCase().includes("waiting for scan") && (
          <div className="space-y-3">
            <div className="text-[10px] text-blue-600 dark:text-blue-400 italic font-medium">
              <strong>Device Status:</strong> Visible in WebUSB but hidden in WebHID? This confirms your scanner is a <strong>Raw USB Device</strong>. The "Access Denied" error means Windows is blocking the browser from speaking to it.
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3 shadow-sm">
              <p className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <Usb className="h-3 w-3" /> Mandatory Driver Fix (Windows)
              </p>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 space-y-2">
                <p>Browsers cannot "Power On" biometric scanners using default Windows drivers. You <strong>MUST</strong> switch to the WinUSB driver:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Download and run <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="underline font-black">Zadig.exe</a>.</li>
                  <li>Go to <strong>Options &gt; List All Devices</strong>.</li>
                  <li>Select your Biometric Scanner (or "MFS100/Morpho/SecuGen") from the list.</li>
                  <li>Ensure the right side says <strong>WinUSB</strong> and click <strong>"Replace Driver"</strong>.</li>
                  <li><strong>Restart your browser</strong> and the scanner light will now turn on.</li>
                </ol>
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-500">Still No Light?</p>
              <ul className="text-[10px] text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-1">
                <li>Use the <strong>WebUSB</strong> button (not HID) since HID does not see your device.</li>
                <li>Ensure no other biometric programs (like Windows Hello) are running.</li>
                <li>Try a USB 2.0 port if you are on a Blue USB 3.0 port.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}