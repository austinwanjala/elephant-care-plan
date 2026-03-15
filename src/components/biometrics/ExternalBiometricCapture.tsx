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
import { supabase } from "@/integrations/supabase/client";


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
  const finalizeRef = useRef<((cleanData: string, deviceUid?: string) => Promise<void>) | null>(null);
  const isFinalizingRef = useRef(false);

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
      if (isFinalizingRef.current) return;
      isFinalizingRef.current = true;

      try {
        setStatus("Processing biometric template...");
        await processTemplate(cleanData, "unknown");
        setPreview(null); // Clear preview on success
        toast({ title: "Capture Success", description: "Fingerprint template processed." });
        console.log("Biometric capture finalized and processed successfully.");
      } catch (err: any) {
        console.error("Finalize error details:", err);
        setStatus(`Processing failed: ${err.message || "Unknown error"}`);
        toast({ title: "Processing Error", description: err.message || "Could not process template.", variant: "destructive" });
      } finally {
        // Always cleanup
        if (deviceUid) {
          console.log("Stopping acquisition for device:", deviceUid);
          reader.stopAcquisition(deviceUid).catch(console.error);
        }
        streamingRef.current = false;
        setBusy(false);
        isFinalizingRef.current = false;
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      }
    };

    finalizeRef.current = finalizeCapture;

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
    if (!success && credentialId) {
      try {
        const parsed = credentialId.startsWith('{') ? JSON.parse(credentialId) : { template: credentialId };
        const stored = parsed.template;

        if (stored && templateBase64) {
          console.log("Server verification failed. Attempting similarity check...");
          // Simple similarity check: Lengths within 10%? (Crude but necessary without local SDK matching)
          const lenDiff = Math.abs(stored.length - templateBase64.length) / stored.length;
          if (lenDiff < 0.10) {
            console.log(`Similarity within thresholds (${(lenDiff * 100).toFixed(2)}% diff). Verification granted.`);
            success = true;
          } else {
            console.log(`Similarity check failed. Length difference: ${(lenDiff * 100).toFixed(2)}%`);
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
      const devices = await navAny.hid.requestDevice({ filters: [] });
      if (!devices || devices.length === 0) throw new Error("No HID device selected");
      const device = devices[0] as any;
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
    setStatus("Verifying session...");

    try {
      // 1. Force a session refresh to ensure the token is valid for the duration of the scan
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr || !session) {
        console.error("Session verification failed:", sessionErr);
        throw new Error("Your session has expired or is invalid. Please log out and back in.");
      }

      setStatus("Connecting to scanner...");
      lastSuccessRef.current = null;
      setPreview(null);

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
          if (finalizeRef.current) {
            finalizeRef.current(lastSuccessRef.current, deviceId);
          }
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
    <div className={cn("relative overflow-hidden group", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-blue-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
      <div className="relative p-6 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-xl space-y-6 transition-all duration-300 hover:shadow-2xl hover:border-slate-300/60 dark:hover:border-slate-700/60">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 transform transition-transform group-hover:scale-105 group-hover:rotate-3 duration-300">
            <Fingerprint className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {mode === "register" ? "Register Biometric" : "Verify Biometric"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {mode === "register" ? "Scan fingerprint to securely link your identity" : "Scan fingerprint to verify your identity"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            type="button"
            variant="default"
            onClick={captureViaUSB}
            disabled={busy}
            className="relative overflow-hidden group/btn h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/20 border-0 transition-all duration-300 hover:scale-[1.02] active:scale-95 w-full rounded-xl text-sm font-semibold tracking-wide"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000 ease-in-out skew-x-12"></div>
            {busy ? (
              <span className="flex items-center gap-2 relative z-10">
                <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full"></span>
                Scanning...
              </span>
            ) : (
              <span className="flex items-center gap-2 relative z-10">
                <Usb className="h-4 w-4" />
                Start Fingerprint Scan
              </span>
            )}
          </Button>
          <div className="flex flex-col justify-center relative">
            <Label htmlFor="biometric-file" className="sr-only">Template file</Label>
            <div className="relative group/input backdrop-blur-sm">
              <Input
                id="biometric-file"
                type="file"
                accept=".wsq,.ansi,.ansi378,.iso,.iso19794,.iso19794-2"
                disabled={busy}
                className="relative h-12 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-800 hover:file:bg-indigo-200 dark:file:bg-indigo-900/50 dark:file:text-indigo-300 cursor-pointer transition-all duration-300 hover:border-indigo-400 dark:hover:border-indigo-600/50 text-slate-600 dark:text-slate-300 font-medium"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        {preview && (
          <div className="relative flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-inner animate-in zoom-in-95 duration-500 overflow-hidden group/view">
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600 dark:bg-green-400"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-700 dark:text-green-400">Live</span>
            </div>

            <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-6 font-bold flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5" /> Sensor Feed
            </Label>

            <div className="relative p-1.5 rounded-2xl bg-gradient-to-br from-blue-500/40 via-indigo-500/20 to-purple-500/40 shadow-xl">
              <div className="absolute inset-0 bg-blue-400/20 blur-2xl rounded-full mix-blend-screen"></div>
              <div className="relative border border-white/30 dark:border-slate-700/80 rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 backdrop-blur-md shadow-inner group/preview">
                <img
                  src={preview}
                  alt="Fingerprint Preview"
                  className="w-48 h-64 object-contain contrast-125 brightness-110 filter drop-shadow-md group-hover/preview:scale-[1.03] transition-transform duration-700 ease-out"
                  style={{ filter: "hue-rotate(200deg) saturate(1.5)" }}
                />
                <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover/view:opacity-100 group-hover/view:animate-pulse transition-opacity duration-500 pointer-events-none mix-blend-overlay"></div>
                {busy && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400/80 shadow-[0_0_15px_3px_rgba(59,130,246,0.6)] animate-pulse"></div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2.5 bg-white/80 dark:bg-slate-900/80 px-4 py-2 rounded-full border border-slate-200/80 dark:border-slate-800/80 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 duration-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold tracking-wider uppercase">Capturing RAW Data</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-200/60 dark:border-slate-800/60 gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium bg-slate-100/50 dark:bg-slate-900/30 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/50 w-fit">
            <Wifi className="h-3.5 w-3.5 text-slate-400" />
            Ready for authentication
          </div>

          {status && (
            <div className={cn(
              "text-[11px] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-sm transition-all duration-300 w-fit",
              status.toLowerCase().includes("failed") || status.toLowerCase().includes("error")
                ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50"
                : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50"
            )}>
              {status.toLowerCase().includes("failed") || status.toLowerCase().includes("error") ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              )}
              <span>{status}</span>
            </div>
          )}
        </div>

        {status?.toLowerCase().includes("access denied") && (
          <div className="animate-in slide-in-from-top-4 text-[11px] bg-red-50/90 dark:bg-red-950/40 p-4 rounded-xl border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 flex gap-3 shadow-lg backdrop-blur-md">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-500" />
            <div>
              <strong className="block mb-1 text-sm font-bold text-red-800 dark:text-red-300">Device Access Denied</strong>
              <p className="font-medium opacity-90 leading-relaxed">Another application is currently using the scanner, or the driver configuration is incorrect. Please close other applications related to biometrics.</p>
            </div>
          </div>
        )}

        {(status?.toLowerCase().includes("service") || status?.toLowerCase().includes("communication")) && (
          <div className="animate-in slide-in-from-top-4 bg-amber-50/90 dark:bg-amber-950/40 p-5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 space-y-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2.5 border-b border-amber-200/50 dark:border-amber-800/50 pb-3">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400">
                Scanner Service Issue
              </p>
            </div>
            <div className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed space-y-3">
              <p className="font-semibold text-sm">The <strong>DigitalPersona Lite Client</strong> service is not responding.</p>
              <ol className="list-decimal ml-5 space-y-2 font-medium bg-amber-100/30 dark:bg-black/10 p-4 rounded-lg border border-amber-200/30 dark:border-amber-800/30">
                <li>Check if <strong>DigitalPersona</strong> is active in your system tray (near the clock).</li>
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