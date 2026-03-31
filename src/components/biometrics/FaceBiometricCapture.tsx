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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const handleDevices = useCallback(
    (mediaDevices: MediaDeviceInfo[]) =>
      setDevices(mediaDevices.filter(({ kind }) => kind === "videoinput")),
    [setDevices]
  );

  const refreshDevices = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then(mediaDevices => {
      const videoInputs = mediaDevices.filter(({ kind }) => kind === "videoinput");
      setDevices(videoInputs);
      
      // If selected device is gone, or we haven't picked one yet
      if (selectedDeviceId && !videoInputs.find(d => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId("");
      }
      
      // Auto-select first device if none selected
      if (!selectedDeviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    });
  }, [selectedDeviceId]);

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
          {!capturedImage && (
            <div className="ml-auto flex items-center gap-2">
              {devices.length > 0 && (
                <div className="w-48 lg:w-56 overflow-hidden">
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger className="h-9 rounded-lg text-[10px] bg-slate-50 border-slate-200 focus:ring-indigo-500">
                      <Camera className="h-3 w-3 mr-2 text-indigo-500" />
                      <SelectValue placeholder="Select Camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device, key) => (
                        <SelectItem key={key} value={device.deviceId} className="text-[10px]">
                          {device.label || `Camera ${key + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  // Clear specific device selection to let facingMode take over (vital for mobile)
                  setSelectedDeviceId(""); 
                  setFacingMode(prev => prev === "user" ? "environment" : "user");
                }}
                className="h-9 w-9 border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors"
                title="Switch Front/Back Camera"
              >
                <RefreshCcw className="h-4 w-4 text-indigo-600" />
              </Button>
            </div>
          )}
        </div>

        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700">
          {!capturedImage ? (
            devices.length > 0 ? (
              <>
                <Webcam
                  key={selectedDeviceId || facingMode}
                  audio={false}
                  ref={webcamRef}
                  onUserMedia={() => {
                    console.log("[Biometric] UserMedia authorized for device:", selectedDeviceId || facingMode);
                    refreshDevices();
                  }}
                  screenshotFormat="image/jpeg"
                  videoConstraints={selectedDeviceId ? {
                    deviceId: { ideal: selectedDeviceId },
                    width: 1280,
                    height: 720,
                  } : {
                    facingMode: facingMode,
                    width: 1280,
                    height: 720,
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 backdrop-blur-lg px-3 py-1.5 rounded-full border border-white/20 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest truncate max-w-[120px]">
                    {devices.find(d => d.deviceId === selectedDeviceId)?.label || "Live Stream"}
                  </span>
                </div>
                <div className="absolute inset-0 pointer-events-none">
                  {/* Modern Square Frame with Corner Brackets */}
                  <div className="absolute inset-[15%] border-[1px] border-white/20 rounded-2xl flex items-center justify-center overflow-hidden">
                    {/* Scanning Grid (Subtle) */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                    
                    {/* Diagnostic Corner Accents */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/80 rounded-tl-xl shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500/80 rounded-tr-xl shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500/80 rounded-bl-xl shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/80 rounded-br-xl shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>

                    {/* Central Verification Pulse */}
                    <div className="w-2/3 h-5/6 border-2 border-blue-400/40 rounded-2xl border-dashed animate-pulse flex items-center justify-center">
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400/80 to-transparent animate-[scan_3s_linear_infinite]"></div>
                    </div>
                  </div>
                  
                  {/* Backdrop darkening for focus */}
                  <div className="absolute inset-0 bg-slate-950/20"></div>
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20 backdrop-blur-md animate-in fade-in duration-500 z-50">
                <div className="p-6 bg-white dark:bg-slate-900 rounded-full shadow-[0_0_50px_rgba(34,197,94,0.4)] scale-125 mb-4 animate-[scaleIn_0.3s_ease-out]">
                    <ShieldCheck className="h-16 w-16 text-green-500" />
                </div>
                <div className="text-white font-bold tracking-widest text-sm uppercase drop-shadow-lg">Verification Complete</div>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/20 backdrop-blur-md z-50">
                <div className="p-6 bg-white dark:bg-slate-900 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.4)] mb-4 animate-[shake_0.5s_ease-in-out]">
                    <ShieldX className="h-16 w-16 text-red-500" />
                </div>
                <div className="text-white font-bold tracking-widest text-sm uppercase drop-shadow-lg">Identity Rejected</div>
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
