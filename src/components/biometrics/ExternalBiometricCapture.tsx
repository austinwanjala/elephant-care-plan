"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Cpu, Fingerprint, Upload, Usb, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerExternalBiometric, verifyExternalBiometric, BiometricFormat } from "@/services/biometrics";
import { DeviceConnected, DeviceDisconnected, DeviceSelection, Devices, CommunicationFailed, SamplesAcquired, SampleFormat, ErrorOccurred } from "@digitalpersona/devices";


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

  useEffect(() => {
    let dpDevices: Devices | null = null;
    
    // We only set this up if we are busy so we don't hold the device open indefinitely
    if (busy) {
      dpDevices = new Devices();
      
      const onDeviceConnected = (e: DeviceConnected) => {
        console.log("DP Device Connected:", e.deviceUid);
      };
      
      const onDeviceDisconnected = (e: DeviceDisconnected) => {
        console.log("DP Device Disconnected:", e.deviceUid);
      };
      
      const onSamplesAcquired = async (e: SamplesAcquired) => {
        console.log("DP Sample Acquired", e);
        try {
          if (e.samples.length > 0) {
            const template = e.samples[0].Data;
            setStatus("Template captured successfully!");
            await processTemplate(template, "unknown"); // Or map the format appropriately
          }
        } catch (err: any) {
          toast({ title: "Template Processing Failed", description: err.message, variant: "destructive" });
        } finally {
          setBusy(false);
          dpDevices?.stopAcquisition(e.deviceUid);
        }
      };
      
      const onErrorOccurred = (e: ErrorOccurred) => {
       console.error("DP Error:", e);
       setStatus("Hardware connection error occurred.");
      };

      dpDevices.on("DeviceConnected", onDeviceConnected);
      dpDevices.on("DeviceDisconnected", onDeviceDisconnected);
      dpDevices.on("SamplesAcquired", onSamplesAcquired);
      dpDevices.on("ErrorOccurred", onErrorOccurred);
      
      // We will tell DP to enumerate and start capturing when "WebUSB/DigitalPersona" is clicked
       return () => {
         dpDevices?.off("DeviceConnected", onDeviceConnected);
         dpDevices?.off("DeviceDisconnected", onDeviceDisconnected);
         dpDevices?.off("SamplesAcquired", onSamplesAcquired);
         dpDevices?.off("ErrorOccurred", onErrorOccurred);
       }
    }
  }, [busy]);

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
        msg = "Access Denied: This HID device is protected by Windows. If this is a Windows Hello reader, it may be blocked by system security for direct HID access.";
      }
      toast({ title: "HID Capture Failed", description: msg, variant: "destructive" });
      setStatus("HID capture failed: " + msg);
    } finally {
      setBusy(false);
    }
  }, [supportsHID, maxDurationMs, mode]);

  const captureViaUSB = useCallback(async () => {
    // We are routing 'WebUSB' capture to use the local Digital Persona websocket 
    // service which is the only reliable way to interact with Digital Persona 4500 natively.
    setBusy(true);
    setStatus("Connecting to DigitalPersona service...");
    try {
      const dpReader = new Devices();
      const deviceList = await dpReader.enumerateDevices();
      
      if (deviceList.length === 0) {
         throw new Error("No DigitalPersona devices found. Ensure the scanner is plugged in and the 'DigitalPersona Lite Client' service is running on your machine.");
      }
      
      const deviceId = deviceList[0];
      setStatus(`Connected to ${deviceId}. LED should turn on...`);
      
      await dpReader.startAcquisition(SampleFormat.Intermediate, deviceId);
      
      // We wait for the 'SamplesAcquired' event to fire in the background effect.
      // Set a generic timeout just in case it hangs
      setTimeout(() => {
        setBusy((prev) => {
          if (prev) {
             dpReader.stopAcquisition(deviceId).catch(console.error);
             setStatus("Capture timed out. Please try again.");
             toast({ title: "Capture Timed Out", description: "No finger detected.", variant: "destructive" });
          }
          return false;
        });
      }, Math.max(maxDurationMs, 10000));
      
    } catch (err: any) {
      let msg = err.message || "Failed to connect to DigitalPersona service.";
      if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network error")) {
        msg = "Could not reach DigitalPersona local service. Please install and run the DigitalPersona WebSDK Lite Client on this machine.";
      }
      toast({ title: "DigitalPersona Capture Failed", description: msg, variant: "destructive" });
      setStatus("Capture failed: " + msg);
      setBusy(false);
    }
  }, [maxDurationMs, processTemplate, toast]);

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
            onClick={captureViaUSB}
            disabled={busy}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-md ring-2 ring-blue-400/20"
          >
            <Usb className="h-4 w-4" />
            DP 4500 (Primary)
          </Button>
          <Button type="button" variant="secondary" onClick={captureViaHID} disabled={!supportsHID || busy} className="flex items-center gap-2 border border-slate-200">
            <Cpu className="h-4 w-4" />
            General HID
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

        {status?.toLowerCase().includes("service") && (
          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3 shadow-sm mt-4">
             <p className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" /> DigitalPersona WebSDK Missing
             </p>
             <div className="text-[10px] text-amber-700 dark:text-amber-300 space-y-2">
                 <p>To use the <strong>U.are.U 4500 reader</strong>, it requires the official HID DigitalPersona local background service to communicate with the browser securely.</p>
                 <p>Please ensure you have installed the <strong>"DigitalPersona Lite Client" (WebSDK)</strong>. Once installed, the service runs quietly in the background on your PC and the "DP 4500" button will successfully trigger the blue laser.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}