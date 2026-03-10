"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Cpu, Fingerprint, Upload, Usb, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerExternalBiometric, verifyExternalBiometric, BiometricFormat } from "@/services/biometrics";

// Hardcoded fallbacks for DigitalPersona constants in case they are not yet in window.dp
const SAMPLE_FORMAT_RAW = 1;
const SAMPLE_FORMAT_PNG = 5;

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
  const [preview, setPreview] = useState<string | null>(null);
  const [supportsHID, setSupportsHID] = useState(false);
  const [supportsUSB, setSupportsUSB] = useState(false);
  const readerRef = useRef<FingerprintReader | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const streamingRef = useRef(false);
  const lastSuccessRef = useRef<string | null>(null);
  const activeDeviceRef = useRef<string | null>(null);

  useEffect(() => {
    setSupportsHID(!!(navigator as any).hid);
    setSupportsUSB(!!(navigator as any).usb);

    // Access fresh globals from window.dp
    const dp = (window as any).dp || {};
    const dpDevices = dp.devices || {};
    const FingerprintReaderClass = dpDevices.FingerprintReader;

    if (!FingerprintReaderClass) {
      console.warn("DigitalPersona FingerprintReader not found in window.dp.devices");
      return;
    }

    // Initialize the DigitalPersona reader once
    const reader = new FingerprintReaderClass();
    readerRef.current = reader;

    const onDeviceConnected = (e: DeviceConnected) => {
      console.log("DP Device Connected:", e.deviceUid);
    };

    const onDeviceDisconnected = (e: DeviceDisconnected) => {
      console.log("DP Device Disconnected:", e.deviceUid);
      setStatus("Scanner disconnected.");
      setBusy(false);
    };

    const onQualityReported = (e: any) => {
      const quality = e.quality !== undefined ? e.quality : e.Quality;
      const deviceId = e.deviceId || e.DeviceId || e.DeviceUid || activeDeviceRef.current;
      
      console.log("DP Quality Reported:", quality);
      if (quality === 0) {
        setStatus("High quality scan detected! Finalizing...");
        if (streamingRef.current && lastSuccessRef.current) {
          finalizeCapture(lastSuccessRef.current, deviceId || undefined);
        }
      } else {
        setStatus(`Place finger on scanner... (Quality: ${quality})`);
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
        const samples = (e as any).samples || (e as any).Samples || [];
        if (samples && samples.length > 0) {
          const sample = samples[0] as any;
          const rawData = sample.Data || sample.data || (typeof sample === 'string' ? sample : null);

          if (!rawData) {
            console.warn("Sample received but no data found in it.");
            return;
          }

          const dataStr = String(rawData);
          let base64Only = dataStr;
          if (dataStr.includes(',')) {
            base64Only = dataStr.split(',')[1] || dataStr;
          }

          const cleanData = (base64Only || "").replace(/\s/g, '');

          // CRITICAL: DigitalPersona sends Base64URL (with - and _). 
          // Browser data URIs REQUIRE standard Base64 (with + and /).
          let normalizedBase64 = cleanData.replace(/-/g, '+').replace(/_/g, '/');
          
          // Add padding if missing
          while (normalizedBase64.length % 4 !== 0) {
            normalizedBase64 += '=';
          }

          const isPng = normalizedBase64.startsWith('iVBORw0');
          const isBmp = normalizedBase64.startsWith('Qk0');
          const sampleFormat = (e as any).sampleFormat || (e as any).SampleFormat;

          if (isPng || isBmp || sampleFormat === 5 || sampleFormat === 1) {
            const mime = isPng ? 'image/png' : 'image/bmp';
            const previewUrl = `data:${mime};base64,${normalizedBase64}`;
            setPreview(previewUrl);
            lastSuccessRef.current = normalizedBase64;
          } else {
            console.warn("Acquired sample is not a recognized image format. Format ID:", sampleFormat);
          }

          if (!streamingRef.current) {
            // Standard mode: finalize on first sample
            const deviceId = e.deviceUid || (e as any).DeviceUid || activeDeviceRef.current;
            await finalizeCapture(normalizedBase64, deviceId || undefined);
          }
        }
      } catch (err: any) {
        console.error("DP onSamplesAcquired error:", err);
        // Don't show toast for every streaming frame error to avoid spamming
        if (!streamingRef.current) {
          toast({ title: "Capture Failed", description: err.message, variant: "destructive" });
        }
      }
    };

    const onErrorOccurred = (e: ErrorOccurred) => {
      console.error("DP Error:", e);
      setStatus("Hardware connection error occurred.");
      setBusy(false);
    };

    const onCommunicationFailed = () => {
      console.error("DP Communication Failed");
      setStatus("Could not reach DigitalPersona service.");
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
    const dp = (window as any).dp || {};
    const dpDevices = dp.devices || {};
    const dpCore = dp.core || {};
    
    // Get fresh SampleFormat enum or use fallback
    const pngFormat = dpDevices.SampleFormat?.PngImage || SAMPLE_FORMAT_PNG;

    if (!dpReader) {
      toast({ title: "SDK Not Ready", description: "The DigitalPersona SDK is still initializing.", variant: "destructive" });
      return;
    }

    setBusy(true);
    setStatus("Initializing scanner...");
    lastSuccessRef.current = null;
    setPreview(null);

    try {
      const deviceList = await dpReader.enumerateDevices();
      if (deviceList.length === 0) {
        throw new Error("No DigitalPersona devices found. Ensure the scanner is plugged in.");
      }

      const deviceId = deviceList[0];
      activeDeviceRef.current = deviceId;
      console.log("Using device:", deviceId);

      // Attempt to enable streaming for "Live Preview"
      const readerObj = dpReader as any;
      if (readerObj.channel && typeof readerObj.channel.send === 'function') {
        streamingRef.current = true;
        
        // Use DeviceUID instead of DeviceID, as it's more standard in WebSDK
        const params = {
          DeviceUID: deviceId,
          SampleFormat: pngFormat,
          Streaming: true
        };

        const encodedParams = dpCore.Base64Url?.fromJSON
          ? dpCore.Base64Url.fromJSON(params)
          : btoa(JSON.stringify(params)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        try {
          // Method 9 is StartAcquisition with support for Streaming
          await readerObj.channel.send({
            Method: 9,
            Parameters: encodedParams
          });
        } catch (err9) {
          console.warn("Method 9 failed, trying Method 3...", err9);
          try {
            await readerObj.channel.send({
              Method: 3,
              Parameters: encodedParams
            });
          } catch (err3) {
            console.error("Both Method 9 and 3 failed for streaming. Falling back to standard acquisition.");
            streamingRef.current = false;
            // Fallback to standard non-streaming acquisition
            await dpReader.startAcquisition(pngFormat, deviceId);
          }
        }
      } else {
        streamingRef.current = false;
        await dpReader.startAcquisition(pngFormat, deviceId);
      }

      setStatus("Live preview active. Place finger on scanner...");

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (streamingRef.current && lastSuccessRef.current) {
          console.log("Capture timeout hit, but we have a preview. Finalizing with last good sample.");
          finalizeCapture(lastSuccessRef.current, deviceId);
        } else if (busy) {
          dpReader.stopAcquisition(deviceId).catch(console.error);
          streamingRef.current = false;
          setStatus("Capture timed out. No fingerprint detected.");
          setBusy(false);
          toast({ title: "Timeout", description: "No finger detected.", variant: "destructive" });
        }
      }, 30000);

    } catch (err: any) {
      console.error("USB Capture Error:", err);
      toast({ title: "Capture Failed", description: err.message, variant: "destructive" });
      setStatus("Error: " + err.message);
      setBusy(false);
    }
  }, [toast, busy]);

  const confirmCapture = () => {
    if (lastSuccessRef.current) {
      finalizeCapture(lastSuccessRef.current, activeDeviceRef.current || undefined);
    }
  };

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
            {busy ? "Scanner Active..." : "Start Fingerprint Scan"}
          </Button>
          {busy && lastSuccessRef.current && (
             <Button
               type="button"
               variant="outline"
               onClick={confirmCapture}
               className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
             >
               <Fingerprint className="h-4 w-4" />
               Capture Now
             </Button>
          )}
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
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative border-4 border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden bg-white shadow-2xl">
                <img
                  src={preview}
                  alt="Fingerprint Preview"
                  className="w-40 h-52 object-contain bg-slate-50 grayscale hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute inset-0 border border-white/20 pointer-events-none"></div>
              </div>
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
          <div className="text-[10px] bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
            <strong>Pro Tip:</strong> Reader likely needs the <strong>WinUSB</strong> driver. Use <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Zadig</a> to replace the current driver.
          </div>
        )}

        {status?.toLowerCase().includes("service") && (
          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3 shadow-sm mt-4">
            <p className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" /> DigitalPersona WebSDK Missing
            </p>
            <div className="text-[10px] text-amber-700 dark:text-amber-300 space-y-2">
              <p>To use the <strong>U.are.U 4500 reader</strong>, ensure you have installed the <strong>"DigitalPersona Lite Client" (WebSDK)</strong>.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}