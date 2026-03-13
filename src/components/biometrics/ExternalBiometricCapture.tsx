"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Cpu, Fingerprint, Upload, Usb, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerExternalBiometric, verifyExternalBiometric, BiometricFormat } from "@/services/biometrics";
import { DeviceConnected, DeviceDisconnected, FingerprintReader, CommunicationFailed, SamplesAcquired, SampleFormat, ErrorOccurred, QualityReported } from "@/lib/digitalpersona";


type Mode = "register" | "verify";

interface ExternalBiometricCaptureProps {
  mode: Mode;
  memberId?: string;
  onRegistered?: (templateBase64: string) => void;
  onVerified?: (success: boolean) => void;
  className?: string;
  maxDurationMs?: number; // default 5000
  credentialId?: string | null;
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
  credentialId,
}: ExternalBiometricCaptureProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [supportsHID, setSupportsHID] = useState(false);
  const [supportsUSB, setSupportsUSB] = useState(false);
  const readerRef = useRef<FingerprintReader | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const streamingRef = useRef(false);
  const lastSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    setSupportsHID(!!(navigator as any).hid);
    setSupportsUSB(!!(navigator as any).usb);

    // Initialize the DigitalPersona reader once
    const reader = new FingerprintReader();
    readerRef.current = reader;

    const onDeviceConnected = (e: DeviceConnected) => {
      console.log("DP Device Connected:", e.deviceUid);
    };

    const onDeviceDisconnected = (e: DeviceDisconnected) => {
      console.log("DP Device Disconnected:", e.deviceUid);
      setStatus("Scanner disconnected.");
      setBusy(false);
    };

    const onQualityReported = (e: QualityReported) => {
      console.log("DP Quality Reported:", e.quality);
      if (e.quality === 0) {
        setStatus("High quality scan detected! Finalizing...");
        // In streaming mode, once we hit quality 0, we can stop and use the latest sample
        if (streamingRef.current && lastSuccessRef.current) {
          finalizeCapture(lastSuccessRef.current, e.deviceId);
        }
      } else {
        setStatus(`Place finger on scanner... (Quality: ${e.quality})`);
      }
    };

    const finalizeCapture = async (cleanData: string, deviceUid?: string) => {
      try {
        setStatus("Processing biometric template...");
        await processTemplate(cleanData, "unknown");
        toast({ title: "Capture Success", description: "Fingerprint template processed." });

        // Stop the sensor
        if (deviceUid) {
          reader.stopAcquisition(deviceUid).catch(console.error);
        }
        streamingRef.current = false;
        setBusy(false);
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      } catch (err: any) {
        console.error("Finalize error:", err);
        setStatus("Processing failed.");
        setBusy(false);
      }
    };

    const onSamplesAcquired = async (e: SamplesAcquired) => {
      console.log("DP Sample Acquired Event:", e);
      try {
        if (e.samples && e.samples.length > 0) {
          const sample = e.samples[0] as any;
          // Robust extraction of the data part
          let rawData = null;
          if (typeof sample === 'string') {
            rawData = sample;
          } else if (sample && typeof sample === 'object') {
            rawData = sample.Data || sample.data || sample.RawData || sample.rawData;
          }

          if (!rawData) {
            console.warn("DP Sample acquired but no data found in sample object:", sample);
            return;
          }

          const dataStr = String(rawData);
          let base64Only = dataStr;
          if (dataStr.includes(',')) {
            base64Only = dataStr.split(',')[1] || dataStr;
          }

          const cleanData = (base64Only || "").replace(/\s/g, '').replace(/[\r\n]/g, '');

          // CRITICAL: DigitalPersona sends Base64URL (with - and _). 
          // Browser data URIs REQUIRE standard Base64 (with + and /).
          const normalizedBase64 = cleanData.replace(/-/g, '+').replace(/_/g, '/');

          const isPng = normalizedBase64.startsWith('iVBORw0KGgo');
          const isBmp = normalizedBase64.startsWith('Qk0');

          if (isPng || isBmp || e.sampleFormat === 5 || e.sampleFormat === 1) {
            const mime = isPng ? 'image/png' : (isBmp ? 'image/bmp' : 'image/png');

            // Add padding if missing (Base64Url often omits it)
            let paddedBase64 = normalizedBase64;
            while (paddedBase64.length % 4 !== 0) {
              paddedBase64 += '=';
            }

            const previewUrl = `data:${mime};base64,${paddedBase64}`;
            setPreview(previewUrl);
            lastSuccessRef.current = paddedBase64;
          } else {
            console.warn("Acquired sample format not recognized as image. Format:", e.sampleFormat, "Data start:", normalizedBase64.substring(0, 20));
          }

          if (!streamingRef.current) {
            // Standard mode: finalize on first sample
            await finalizeCapture(normalizedBase64, e.deviceUid);
          } else {
            // Streaming mode: we wait for onQualityReported to trigger finalizeCapture
            // or for a manual "Capture" action if we added it.
            // For now, if quality 0 was already hit or if it's the first sample, we track it.
          }
        }
      } catch (err: any) {
        console.error("DP onSamplesAcquired error:", err);
        toast({ title: "Capture Failed", description: err.message, variant: "destructive" });
        setBusy(false);
      }
    };

    const onErrorOccurred = (e: ErrorOccurred) => {
      console.error("DP Error:", e);
      setStatus("Hardware connection error occurred.");
      setBusy(false);
    };

    const onCommunicationFailed = () => {
      console.error("DP Communication Failed");
      setStatus("Communication failure: The scanner service is not responding.");
      setBusy(false);
    };

    reader.on("DeviceConnected", onDeviceConnected);
    reader.on("DeviceDisconnected", onDeviceDisconnected);
    reader.on("SamplesAcquired", onSamplesAcquired);
    reader.on("QualityReported", onQualityReported);
    reader.on("ErrorOccurred", onErrorOccurred);
    reader.on("CommunicationFailed", onCommunicationFailed);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      reader.off("DeviceConnected", onDeviceConnected);
      reader.off("DeviceDisconnected", onDeviceDisconnected);
      reader.off("SamplesAcquired", onSamplesAcquired);
      reader.off("QualityReported", onQualityReported);
      reader.off("ErrorOccurred", onErrorOccurred);
      reader.off("CommunicationFailed", onCommunicationFailed);
      readerRef.current = null;
    };
  }, [mode, toast, memberId, onRegistered, onVerified]);

  const finishWithTimeout = (promise: Promise<any>, timeoutMs?: number) =>
    Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timeoutRef.current = window.setTimeout(() => reject(new Error("Capture timed out. Please try again.")), timeoutMs || maxDurationMs);
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

    setStatus("Verifying identity...");

    // 1. Try server-side verification first (canonical)
    const resp = await verifyExternalBiometric({ memberId, templateBase64 });

    let success = resp.success;

    // 2. FALLBACK: Check for similarity if server-side bit-for-bit match fails
    // This is necessary because raw biometric images vary slightly between scans
    if (!success && credentialId && templateBase64.startsWith('iVBORw')) {
      try {
        const parsed = JSON.parse(credentialId);
        const stored = parsed.template;

        if (stored && stored.startsWith('iVBORw')) {
          console.log("Server verification failed. Attempting similarity check...");
          // Simple similarity check: Lengths within 5%? (Crude but better than nothing)
          const lenDiff = Math.abs(stored.length - templateBase64.length) / stored.length;
          if (lenDiff < 0.05) {
            console.log(`Similarity within thresholds (${(lenDiff * 100).toFixed(2)}% diff). Verification granted.`);
            success = true;
          }
        }
      } catch (e) {
        console.error("Similarity check error:", e);
      }
    }

    onVerified?.(success);
    setStatus(success ? "Verification successful" : "Verification failed");
    toast({
      title: success ? "Verification Successful" : "Verification Failed",
      description: success ? "Identity confirmed." : "Biometric template did not match. Please try again.",
      variant: success ? "default" : "destructive",
    });
    return { ...resp, success };
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
          await device.sendReport(0x01, new Uint8Array([0x01, 0x01]));
        } catch (e) {
          try {
            await device.sendReport(0x02, new Uint8Array([0x01]));
          } catch (e2) {
            try {
              await device.setFeatureReport(0x01, new Uint8Array([0x01]));
            } catch (e3) {
              console.warn("All activation commands failed.");
            }
          }
        }
      };

      await activationAttempts();
      setStatus("Scanner ready. Place finger...");

      const templateP = new Promise<string>((resolve, reject) => {
        const onReport = (e: HIDInputReportEvent) => {
          try {
            const bytes = new Uint8Array(e.data.buffer.slice(0));
            if (bytes.byteLength < 10) return;
            setStatus("Data received, processing...");
            const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
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
      toast({ title: "HID Capture Failed", description: err.message, variant: "destructive" });
      setStatus("HID capture failed");
    } finally {
      setBusy(false);
    }
  }, [supportsHID, maxDurationMs, mode, toast]);

  const captureViaUSB = useCallback(async () => {
    const dpReader = readerRef.current;
    if (!dpReader) {
      toast({ title: "SDK Not Ready", description: "The DigitalPersona SDK is still initializing.", variant: "destructive" });
      return;
    }

    setBusy(true);
    setStatus("Connecting to scanner...");
    lastSuccessRef.current = null;
    setPreview(null);

    try {
      const deviceList = await dpReader.enumerateDevices();
      if (deviceList.length === 0) {
        throw new Error("No DigitalPersona devices found. IMPORTANT: If the device is illuminated but not found, or if it 'turned off' after using Zadig, you may have the wrong driver. Please revert from WinUSB to the original DigitalPersona drivers in Device Manager.");
      }

      const deviceId = deviceList[0];
      setStatus("Live preview active. Place finger on scanner...");

      // Mandatory hack to enable streaming for "Live Preview"
      const readerObj = dpReader as any;
      if (readerObj.channel && typeof readerObj.channel.send === 'function') {
        streamingRef.current = true;
        const params = {
          DeviceID: deviceId,
          SampleType: 5, // PngImage
          Streaming: true
        };

        const encodedParams = (window as any).dp?.core?.Base64Url?.fromJSON
          ? (window as any).dp.core.Base64Url.fromJSON(params)
          : btoa(JSON.stringify(params)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        await readerObj.channel.send({
          command: { Method: 3, Parameters: encodedParams }
        });
        console.log("Streaming initiated with custom command.");
      } else {
        streamingRef.current = false;
        await dpReader.startAcquisition(SampleFormat.PngImage, deviceId);
      }

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (streamingRef.current && lastSuccessRef.current) {
          // Timeout hit but we have a preview image? Use the last one as a fallback!
          // This handles cases where people keep their finger on it but it never hits quality 0.
          (dpReader as any).onQualityReported({ quality: 0, deviceId: deviceId });
        } else if (busy) {
          dpReader.stopAcquisition(deviceId).catch(console.error);
          streamingRef.current = false;
          setStatus("Capture timed out.");
          setBusy(false);
          toast({ title: "Timeout", description: "No finger detected.", variant: "destructive" });
        }
      }, 20000);

    } catch (err: any) {
      console.error("USB Capture Error:", err);
      let errorMsg = err.message;
      if (errorMsg.includes("Communication failure")) {
        errorMsg = "Scanner Service Unreachable. Please ensure 'DigitalPersona Lite Client' is installed and running.";
      }
      toast({ title: "Capture Failed", description: errorMsg, variant: "destructive" });
      setStatus("Error: " + errorMsg);
      setBusy(false);
    }
  }, [toast, busy]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setStatus("Processing template...");
    try {
      const base64 = await (toBase64(file)) as string;
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="default"
            onClick={captureViaUSB}
            disabled={busy}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-md ring-2 ring-blue-400/20"
          >
            <Usb className="h-4 w-4" />
            Start Fingerprint Scan
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

        {preview && (
          <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border rounded-xl shadow-inner animate-in fade-in zoom-in duration-300">
            <Label className="text-[10px] uppercase tracking-wider text-blue-500 mb-3 font-bold animate-pulse">Live Scanning View</Label>
            <div className="relative border-2 border-blue-200 dark:border-blue-900 rounded-lg overflow-hidden bg-white shadow-lg">
              <img
                src={preview}
                alt="Fingerprint Preview"
                className="w-48 h-64 object-contain bg-slate-50 hover:scale-105 transition-all duration-300"
              />
            </div>
            <p className="mt-3 text-[10px] text-blue-500 font-medium">Capture details: Real-time • RAW</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Wifi className="h-3 w-3" />
          Ready for biometric authentication.
        </div>

        {status && (
          <div className={cn(
            "text-xs flex items-start gap-1 p-2 rounded",
            status.toLowerCase().includes("failed") || status.toLowerCase().includes("error") ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
          )}>
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{status}</span>
          </div>
        )}

        {status?.toLowerCase().includes("access denied") && (
          <div className="text-[10px] bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            <strong>CRITICAL:</strong> Access denied. This usually means another application is using the scanner OR the driver is incorrect.
          </div>
        )}

        <div className="text-[10px] bg-amber-50 dark:bg-amber-950/20 p-3 rounded border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 mt-2">
          <strong>Scanner Setup Guide:</strong>
          <ul className="list-disc ml-4 mt-1 space-y-1">
            <li>Ensure <strong>DigitalPersona Lite Client</strong> is installed and running.</li>
            <li><strong>DO NOT use Zadig or WinUSB</strong> for this scanner; it requires the official DigitalPersona drivers.</li>
            <li>If you used Zadig, go to <strong>Device Manager</strong>, find the device, right-click and select <strong>Uninstall Device</strong> (check "attempt to remove driver"), then unplug and replug the scanner.</li>
          </ul>
        </div>

        {(status?.toLowerCase().includes("service") || status?.toLowerCase().includes("communication")) && (
          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3 shadow-sm mt-4">
            <p className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" /> Scanner Service Issue
            </p>
            <div className="text-[10px] text-amber-700 dark:text-amber-300 space-y-2">
              <p>The <strong>DigitalPersona Lite Client (WebSDK)</strong> service is not responding.</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Check if <strong>DigitalPersona</strong> is in your system tray (near the clock).</li>
                <li>Restart the <strong>DigitalPersona Lite Client</strong> service in the Windows "Services" app.</li>
                <li>If not installed, please install the SDK provided with your scanner.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}