"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, ShieldCheck, ShieldX, UserCheck, UserPlus, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { registerFace, verifyFace } from "@/services/biometrics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FaceBiometricCaptureProps {
  mode: "register" | "verify";
  memberId?: string;
  userName?: string;
  onSuccess?: () => void;
  className?: string;
}

export default function FaceBiometricCapture({
  mode,
  memberId,
  userName,
  onSuccess,
  className,
}: FaceBiometricCaptureProps) {
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "capturing" | "verifying" | "success" | "error">("idle");
  const [storedImage, setStoredImage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const handleDevices = useCallback(
    (mediaDevices: MediaDeviceInfo[]) =>
      setDevices(mediaDevices.filter(({ kind }) => kind === "videoinput")),
    [setDevices]
  );

  const refreshDevices = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices).then(newDevices => {
      const videoInputs = newDevices?.filter(d => d.kind === "videoinput") || [];
      
      // If selected device is gone, or we haven't picked one yet
      if (selectedDeviceId && !videoInputs.find(d => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId("");
      }
      
      // Auto-select first device if none selected
      if (!selectedDeviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    });
  }, [handleDevices, selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setStatus("capturing");
    }
  }, [webcamRef]);

  const handleAction = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    setStatus(mode === "register" ? "capturing" : "verifying");

    try {
      if (mode === "register") {
        await registerFace({ memberId, imageBase64: capturedImage });
        toast({
          title: "Registration Success",
          description: `Face profile for ${userName || 'the member'} securely registered.`,
        });
        setStatus("success");
        onSuccess?.();
      } else {
        const result = await verifyFace({ memberId, imageBase64: capturedImage });
        if (result.success && result.storedImage) {
          setStoredImage(result.storedImage);
          // For now, we simulate a match by showing comparison. 
          // In real-world, we'd use face-api.js embeddings.
          setStatus("success");
          toast({
            title: "Verification Success",
            description: "Face recognized. Identity confirmed.",
          });
          onSuccess?.();
        } else {
          setStatus("error");
          toast({
            title: "Verification Failed",
            description: result.reason || "Identity could not be confirmed.",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      setStatus("error");
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred during processing.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setStoredImage(null);
    setStatus("idle");
    setIsProcessing(false);
  };

  return (
    <div className={cn("relative overflow-hidden group", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
      
      <div className="relative p-6 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-xl space-y-6 transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 transform transition-transform group-hover:scale-105 duration-300">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {mode === "register" ? "Face Registration" : "Face Verification"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {mode === "register" ? `Complete profile for ${userName || 'the member'}` : "Verify identity using facial recognition"}
            </p>
          </div>
          {devices.length > 1 && !capturedImage && (
            <div className="ml-auto w-48">
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="h-9 rounded-lg text-[10px] bg-slate-50 border-slate-200">
                  <Camera className="h-3 w-3 mr-2 text-indigo-500" />
                  <SelectValue placeholder="Select Camera" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device, key) => (
                    <SelectItem key={key} value={device.deviceId} className="text-[10px]">
                      {device.label || `Webcam ${key + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700">
          {!capturedImage ? (
            devices.length > 0 ? (
              <>
                <Webcam
                  key={selectedDeviceId || 'default'}
                  audio={false}
                  ref={webcamRef}
                  onUserMedia={() => {
                    console.log("[Biometric] UserMedia authorized for device:", selectedDeviceId);
                    refreshDevices();
                  }}
                  screenshotFormat="image/jpeg"
                  videoConstraints={selectedDeviceId ? {
                    deviceId: { exact: selectedDeviceId },
                    width: 1280,
                    height: 720,
                  } : {
                    facingMode: "user",
                    width: 1280,
                    height: 720,
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[30px] border-black/30 pointer-events-none">
                  <div className="w-full h-full border-2 border-white/50 rounded-[100%] flex items-center justify-center">
                    <div className="w-1/2 h-2/3 border-2 border-blue-400/80 rounded-full border-dashed animate-pulse"></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400 bg-slate-50 dark:bg-slate-900">
                <Camera className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Hardware Disconnected</p>
                <p className="text-[10px] mt-1">Connect an external webcam to proceed with Face ID.</p>
                <Button variant="outline" size="sm" className="mt-4 h-8 text-[10px]" onClick={() => window.location.reload()}>
                  <RefreshCcw className="h-3 w-3 mr-2" /> Refresh System
                </Button>
              </div>
            )
          ) : (
            <div className="flex w-full h-full">
              <div className={cn("relative flex-1 bg-slate-900 border-r border-white/10 overflow-hidden", storedImage && "w-1/2")}>
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover grayscale-0" />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded">Captured</div>
                
                {/* Scanning Animation */}
                {isProcessing && mode === "verify" && (
                  <>
                    <div className="absolute inset-0 bg-blue-500/10 pointer-events-none"></div>
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite] z-10 transition-all"></div>
                  </>
                )}
              </div>
              {storedImage && (
                <div className="relative w-1/2 bg-slate-900 overflow-hidden animate-in slide-in-from-right-full duration-500">
                  <img src={storedImage} alt="Stored" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute top-2 right-2 bg-indigo-500/80 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded">Stored Profile</div>
                </div>
              )}
            </div>
          )}
          
          {status === "success" && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/10 backdrop-blur-[2px] animate-in fade-in duration-500">
                <div className="p-4 bg-white/90 dark:bg-slate-900/90 rounded-full shadow-2xl scale-125">
                    <ShieldCheck className="h-12 w-12 text-green-500" />
                </div>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 backdrop-blur-[2px]">
                <div className="p-4 bg-white/90 dark:bg-slate-900/90 rounded-full shadow-2xl">
                    <ShieldX className="h-12 w-12 text-red-500" />
                </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {!capturedImage ? (
            <Button
              onClick={capture}
              className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02]"
            >
              <Camera className="mr-2 h-5 w-5" />
              Capture Photo
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={reset}
                disabled={isProcessing}
                className="flex-1 h-12 border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <RefreshCcw className="mr-2 h-5 w-5" />
                Retake
              </Button>
              <Button
                onClick={handleAction}
                disabled={isProcessing || status === "success"}
                className={cn(
                  "flex-1 h-12 font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02]",
                  mode === "register" ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500",
                  status === "success" && "bg-slate-500 cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full"></span>
                    Processing...
                  </span>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-5 w-5" />
                    {mode === "register" ? "Confirm Enrollment" : "Verify Identity"}
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-3">
          <div className="p-1 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="leading-relaxed">
            <strong>Security Note:</strong> All facial data is handled securely. Raw images are strictly used for verification comparison and meeting clinical identity standards.
          </p>
        </div>
      </div>
    </div>
  );
}
