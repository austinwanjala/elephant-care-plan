import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, Smartphone, CreditCard } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { kopokopoService } from "@/services/kopokopo";

interface MembershipCategory {
    id: string;
    name: string;
    payment_amount: number;
    benefit_amount: number;
}

interface InsufficientBalanceHandlerProps {
    member: {
        id: string;
        full_name: string;
        phone: string;
        coverage_balance: number;
    };
    requiredAmount: number;
    onPaymentSuccess: () => void;
    onCancel: () => void;
}

export const InsufficientBalanceHandler: React.FC<InsufficientBalanceHandlerProps> = ({
    member,
    requiredAmount,
    onPaymentSuccess,
    onCancel
}) => {
    const [categories, setCategories] = useState<MembershipCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [customAmount, setCustomAmount] = useState<string>("");
    const [paymentPhone, setPaymentPhone] = useState<string>(member.phone || "");
    const [loading, setLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
    const [resourceId, setResourceId] = useState<string | null>(null);
    const { toast } = useToast();

    const deficit = requiredAmount - member.coverage_balance;

    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await supabase
                .from("membership_categories")
                .select("id, name, payment_amount, benefit_amount")
                .eq("is_active", true)
                .order("payment_amount", { ascending: true });

            if (data) setCategories(data);
        };
        fetchCategories();
    }, []);

    // Poll for payment status using the payment row created by the KopoKopo edge function.
    useEffect(() => {
        if (paymentStatus !== 'pending' || !resourceId) return;

        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;

            // Nudge KopoKopo status every few tries (webhook delays happen)
            if (attempts % 3 === 0) {
                await kopokopoService.checkStatus(resourceId).catch(() => null);
            }

            const { data, error } = await (supabase as any)
                .from("payments")
                .select("status")
                .eq("kopo_resource_id", resourceId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error) {
                if (data?.status === 'completed') {
                    setPaymentStatus('success');
                    clearInterval(interval);
                    toast({ title: "Payment Successful", description: "Coverage balance has been updated." });
                    setTimeout(() => onPaymentSuccess(), 1200);
                } else if (data?.status === 'failed') {
                    setPaymentStatus('failed');
                    clearInterval(interval);
                    toast({ title: "Payment Failed", description: "The STK push was not successful.", variant: "destructive" });
                }
            }

            if (attempts > 20) {
                setPaymentStatus('failed');
                clearInterval(interval);
                toast({ title: "Timeout", description: "Payment verification timed out.", variant: "destructive" });
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [paymentStatus, resourceId, onPaymentSuccess, toast]);

    const handleInitiatePayment = async () => {
        setLoading(true);
        try {
            const phone = paymentPhone.trim();
            if (!phone) throw new Error("Please enter a valid mobile number for payment.");

            let amountToPay = 0;
            let coverageToAdd = 0;
            let paymentType = "topup";
            let invoiceNumber: string | undefined;

            if (selectedCategory) {
                const category = categories.find(c => c.id === selectedCategory);
                if (category) {
                    amountToPay = category.payment_amount;
                    coverageToAdd = category.benefit_amount;
                    paymentType = "renewal_upgrade";
                    invoiceNumber = `RENEWAL-${Date.now()}`;
                }
            } else if (customAmount) {
                amountToPay = parseFloat(customAmount);
                coverageToAdd = amountToPay;
                paymentType = "topup";
                invoiceNumber = `TOPUP-${Date.now()}`;
            } else {
                throw new Error("Please select a scheme or enter a top-up amount.");
            }

            if (amountToPay <= 0) throw new Error("Invalid payment amount.");

            // Trigger STK Push via KopoKopo (edge function will create the pending payment row)
            const response = await kopokopoService.initiateStkPush({
                amount: amountToPay,
                phone: phone,
                memberId: member.id,
                paymentType,
                coverageAmount: coverageToAdd,
                invoiceNumber,
            });

            const rid = response?.resource_id;
            if (!rid) throw new Error("Missing payment resource id.");

            setResourceId(rid);
            setPaymentStatus('pending');
            toast({ title: "STK Push Sent", description: "Please check the patient's phone to complete the payment." });

        } catch (error: any) {
            toast({ title: "Payment Initiation Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-red-200 shadow-lg animate-in fade-in zoom-in duration-300">
            <CardHeader className="bg-red-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <CardTitle className="text-red-900 text-xl font-bold">INSUFFICIENT BALANCE</CardTitle>
                        <CardDescription className="text-red-700">RENEW OR TOP-UP TO CONTINUE BILLING</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <Label className="text-xs text-slate-500 uppercase font-bold">Current Balance</Label>
                        <p className="text-lg font-mono font-bold">KES {member.coverage_balance.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <Label className="text-xs text-blue-500 uppercase font-bold">Deficit Amount</Label>
                        <p className="text-lg font-mono font-bold text-blue-700">KES {deficit.toLocaleString()}</p>
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    {/* ── Mobile Number for STK Push ── */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-blue-600" />
                            Mobile Number for STK Push
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">+</span>
                            <Input
                                type="tel"
                                placeholder="e.g. 0712345678"
                                className="pl-7 font-mono"
                                value={paymentPhone}
                                onChange={(e) => setPaymentPhone(e.target.value)}
                                disabled={paymentStatus === 'pending' || paymentStatus === 'success'}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Pre-filled from member profile. Change if the payer is using a different phone.</p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Option 1: Choose New Scheme / Renewal</Label>
                        <Select value={selectedCategory} onValueChange={(val) => {
                            setSelectedCategory(val);
                            setCustomAmount("");
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a membership scheme" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name} (KES {cat.payment_amount.toLocaleString()} to Benefit: KES {cat.benefit_amount.toLocaleString()})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground font-bold">OR</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Option 2: Instant Top-up Plan (Custom Amount)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KES</span>
                                <Input
                                    type="number"
                                    placeholder="Enter amount to top up"
                                    className="pl-12"
                                    value={customAmount}
                                    onChange={(e) => {
                                        setCustomAmount(e.target.value);
                                        setSelectedCategory("");
                                    }}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Top-up amount will be added directly to the coverage balance.</p>
                    </div>
                </div>

                {paymentStatus === 'pending' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col items-center gap-3 text-center animate-pulse">
                        <Smartphone className="h-10 w-10 text-amber-600" />
                        <div>
                            <p className="font-bold text-amber-900">Waiting for STK Confirmation...</p>
                            <p className="text-xs text-amber-700">Confirm payment on phone: <span className="font-mono font-bold">{paymentPhone}</span></p>
                        </div>
                        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                    </div>
                )}

                {paymentStatus === 'success' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center gap-3 text-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                        <div>
                            <p className="font-bold text-green-900">Payment Verified!</p>
                            <p className="text-xs text-green-700">Continuing with billing process...</p>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex gap-3 bg-slate-50 border-t pt-4">
                <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading || paymentStatus === 'pending'}>
                    Cancel
                </Button>
                <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                    onClick={handleInitiatePayment}
                    disabled={loading || paymentStatus === 'pending' || paymentStatus === 'success'}
                >
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    Trigger STK Push
                </Button>
            </CardFooter>
        </Card>
    );
};