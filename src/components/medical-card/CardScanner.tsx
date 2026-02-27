import React, { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
    Camera,
    Upload,
    QrCode,
    Search,
    Loader2,
    CheckCircle2,
    XCircle,
    ShieldCheck,
    CreditCard,
    User,
    History
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VerificationResult {
    status: string;
    member_name: string;
    member_number: string;
    scheme: string;
    balance: number;
    expiry_date: string;
    dependants: any[];
    eligible: boolean;
    remarks: string;
    active_visits?: any[];
}

const CardScanner: React.FC = () => {
    const [activeTab, setActiveTab] = useState<"qr" | "ocr" | "result">("qr");
    const [loading, setLoading] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [result, setResult] = useState<VerificationResult | null>(null);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        if (activeTab === "qr") {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
            );

            scanner.render(
                (decodedText) => {
                    scanner.clear();
                    handleVerify({ qrToken: decodedText });
                },
                (error) => {
                    // console.warn(error);
                }
            );

            scannerRef.current = scanner;
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, [activeTab]);

    const handleVerify = async (data: { qrToken?: string; ocrText?: string }) => {
        setLoading(true);
        try {
            const { data: response, error } = await supabase.functions.invoke("verify-insurance-card", {
                body: {
                    ...data,
                    branchId: "b84518d6-444f-40c3-9878-5e87a27eb494", // Example branch ID
                    deviceId: navigator.userAgent
                },
            });

            if (error) throw error;

            setResult(response);
            setActiveTab("result");
            toast.success("Card verified successfully!");
        } catch (error: any) {
            console.error("Verification failed", error);
            toast.error(error.message || "Failed to verify card");
            if (activeTab === "qr") setActiveTab("qr"); // Restart QR if failed
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setOcrProgress(0);

        try {
            toast.info("Processing card image with AI OCR...");
            const result = await Tesseract.recognize(
                file,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setOcrProgress(Math.round(m.progress * 100));
                        }
                    }
                }
            );

            const extractedText = result.data.text;
            console.log("OCR Text:", extractedText);
            handleVerify({ ocrText: extractedText });
        } catch (error: any) {
            toast.error("OCR OCR failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <div className="flex gap-2 justify-center p-1 bg-muted rounded-lg w-fit mx-auto">
                <Button
                    variant={activeTab === "qr" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("qr")}
                    className="gap-2"
                >
                    <QrCode className="h-4 w-4" /> QR Scanner
                </Button>
                <Button
                    variant={activeTab === "ocr" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("ocr")}
                    className="gap-2"
                >
                    <Camera className="h-4 w-4" /> OCR Reader
                </Button>
            </div>

            <Card className="border-2 shadow-lg overflow-hidden">
                <CardHeader className="bg-primary/5 text-center">
                    <CardTitle className="flex items-center justify-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Coverage Verification
                    </CardTitle>
                    <CardDescription>
                        Scan a member's digital or physical card for instant validation
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-0">
                    {activeTab === "qr" && (
                        <div className="p-6">
                            <div id="reader" className="w-full rounded-xl overflow-hidden border-2 border-dashed border-primary/30" />
                            <p className="text-center text-sm text-muted-foreground mt-4 animate-pulse">
                                Position the QR code within the frame
                            </p>
                        </div>
                    )}

                    {activeTab === "ocr" && (
                        <div className="p-8 flex flex-col items-center justify-center space-y-6">
                            <div
                                className="w-full h-48 border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group"
                                onClick={() => document.getElementById("file-upload")?.click()}
                            >
                                {loading ? (
                                    <div className="text-center space-y-3">
                                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                                        <p className="font-bold text-primary">AI Extracting: {ocrProgress}%</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-primary/10 p-4 rounded-full group-hover:scale-110 transition-transform">
                                            <Upload className="h-8 w-8 text-primary" />
                                        </div>
                                        <p className="mt-4 font-semibold text-slate-700">Upload Card Photo</p>
                                        <p className="text-xs text-muted-foreground">Supports JPG, PNG with high accuracy OCR</p>
                                    </>
                                )}
                            </div>
                            <Input
                                id="file-upload"
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                                disabled={loading}
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900">
                                <ShieldCheck className="h-4 w-4 text-amber-600" />
                                <span>Powered by Secure OCR Engine. No personal data is stored during extraction.</span>
                            </div>
                        </div>
                    )}

                    {activeTab === "result" && result && (
                        <div className="p-6 space-y-6 animate-in fade-in zoom-in duration-300">
                            <div className={`p-6 rounded-2xl border-2 flex flex-col items-center text-center space-y-3 ${result.eligible ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900"
                                }`}>
                                {result.eligible ? (
                                    <div className="p-3 bg-emerald-500 rounded-full text-white">
                                        <CheckCircle2 className="h-10 w-10" />
                                    </div>
                                ) : (
                                    <div className="p-3 bg-rose-500 rounded-full text-white">
                                        <XCircle className="h-10 w-10" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-2xl font-black">{result.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</h3>
                                    <p className={`font-bold ${result.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                                        {result.remarks}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                                    <div className="flex items-center gap-2 text-primary">
                                        <User className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Member Details</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-lg leading-tight uppercase">{result.member_name}</p>
                                        <p className="text-xs font-mono text-muted-foreground">{result.member_number}</p>
                                    </div>
                                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                        {result.scheme} Scheme
                                    </Badge>
                                </div>

                                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                                    <div className="flex items-center gap-2 text-primary">
                                        <CreditCard className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Financial Status</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-2xl leading-tight">KES {result.balance.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Available Balance</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase">
                                        <Loader2 className="h-3 w-3" />
                                        Exp: {result.expiry_date}
                                    </div>
                                </div>
                            </div>

                            {result.active_visits && result.active_visits.length > 0 && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                        <History className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">In-Progress Services</span>
                                    </div>
                                    {result.active_visits.map((visit: any) => (
                                        <div key={visit.id} className="text-sm font-semibold flex justify-between items-center">
                                            <span>Multi-stage Procedure</span>
                                            <Badge variant="outline" className="text-[10px] uppercase border-amber-500 text-amber-600">
                                                {visit.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setResult(null);
                                    setActiveTab("qr");
                                }}
                            >
                                Verify Another Card
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CardScanner;
