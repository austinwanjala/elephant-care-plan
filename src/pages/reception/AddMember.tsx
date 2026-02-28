import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Plus, CheckCircle2, Smartphone, CreditCard,
    ArrowRight, User, Star, AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { kopokopoService } from "@/services/kopokopo";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface MembershipCategory {
    id: string;
    name: string;
    payment_amount: number;
    benefit_amount: number;
    registration_fee: number;
    management_fee: number;
    description?: string;
}

type Step = 'form' | 'payment' | 'done';

export default function AddMember() {
    const { toast } = useToast();
    const [step, setStep] = useState<Step>('form');
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<MembershipCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [paymentPhone, setPaymentPhone] = useState<string>("");
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
    const [resourceId, setResourceId] = useState<string | null>(null);
    const [registeredMemberId, setRegisteredMemberId] = useState<string | null>(null);
    const [registeredMemberName, setRegisteredMemberName] = useState<string>("");

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        idNumber: "",
        age: "",
        password: "",
    });

    // Load membership schemes on mount
    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await supabase
                .from("membership_categories")
                .select("id, name, payment_amount, benefit_amount, registration_fee, management_fee")
                .eq("is_active", true)
                .order("payment_amount", { ascending: true });
            if (data) setCategories(data as MembershipCategory[]);
        };
        fetchCategories();
    }, []);

    // Poll for payment completion
    useEffect(() => {
        if (paymentStatus !== 'pending' || !resourceId) return;

        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;

            // Nudge KopoKopo status check every few tries
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
                    setStep('done');
                    toast({ title: "Payment Confirmed!", description: `${registeredMemberName} is now active and covered.` });
                } else if (data?.status === 'failed') {
                    setPaymentStatus('failed');
                    clearInterval(interval);
                    toast({ title: "Payment Failed", description: "STK push was not completed. You can retry.", variant: "destructive" });
                }
            }

            if (attempts > 20) {
                setPaymentStatus('failed');
                clearInterval(interval);
                toast({ title: "Timeout", description: "Payment verification timed out. Please retry.", variant: "destructive" });
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [paymentStatus, resourceId, registeredMemberName, toast]);

    const handleRegisterMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategory) {
            toast({ title: "Scheme Required", description: "Please select a membership scheme before registering.", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            const ageInt = parseInt(formData.age);
            if (isNaN(ageInt)) throw new Error("Please enter a valid age.");

            const category = categories.find(c => c.id === selectedCategory);

            const { data: authData, error: authError } = await supabase.functions.invoke("admin-create-user", {
                body: {
                    email: formData.email,
                    password: formData.password,
                    metadata: {
                        role: 'member',
                        full_name: formData.fullName,
                        phone: formData.phone,
                        id_number: formData.idNumber,
                        age: ageInt,
                        // Pass category so the trigger/edge function can set it
                        membership_category_id: selectedCategory,
                    }
                }
            });

            if (authError) throw authError;

            const userId = authData?.user?.id;

            let fetchedMemberId = null;

            // Retry loop up to 5 times (max 2.5s) in case the postgres trigger is slightly delayed
            for (let i = 0; i < 5; i++) {
                let query = supabase.from("members").select("id");

                if (userId) {
                    query = query.eq("user_id", userId);
                } else {
                    query = query.eq("email", formData.email);
                }

                const { data: memberRow } = await query.maybeSingle();

                if (memberRow?.id) {
                    fetchedMemberId = memberRow.id;
                    break;
                }

                await new Promise(res => setTimeout(res, 500));
            }

            if (fetchedMemberId) {
                // Update their category in case the trigger didn't set it
                await supabase
                    .from("members")
                    .update({ membership_category_id: selectedCategory })
                    .eq("id", fetchedMemberId);

                setRegisteredMemberId(fetchedMemberId);
            } else {
                console.warn("Could not retrieve member ID immediately after creation.");
            }

            setRegisteredMemberName(formData.fullName);
            setPaymentPhone(formData.phone);

            // Send Welcome SMS
            try {
                await supabase.functions.invoke('send-sms', {
                    body: {
                        type: 'welcome',
                        phone: formData.phone,
                        data: {
                            name: formData.fullName,
                            scheme: category?.name,
                        }
                    }
                });
            } catch (smsErr) {
                console.error("Failed to send welcome SMS:", smsErr);
            }

            toast({
                title: "Member Registered",
                description: `${formData.fullName} registered. Now initiate payment to activate their coverage.`
            });

            setStep('payment');
        } catch (error: any) {
            toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSendStkPush = async () => {
        const phone = paymentPhone.trim();
        if (!phone) {
            toast({ title: "Phone Required", description: "Enter a valid M-Pesa number.", variant: "destructive" });
            return;
        }
        const category = categories.find(c => c.id === selectedCategory);
        if (!category) {
            toast({ title: "Error", description: "Scheme not found.", variant: "destructive" });
            return;
        }

        if (!registeredMemberId) {
            toast({ title: "Error", description: "Member profile ID is missing. The database trigger might be delayed. Please cancel and look up the member.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const totalAmount = category.payment_amount + category.registration_fee + category.management_fee;

            const response = await kopokopoService.initiateStkPush({
                amount: totalAmount,
                phone,
                memberId: registeredMemberId,
                paymentType: "new_registration",
                coverageAmount: category.benefit_amount,
                invoiceNumber: `REG-${Date.now()}`,
            });

            const rid = response?.resource_id;
            if (!rid) throw new Error("Missing payment resource ID from gateway.");

            setResourceId(rid);
            setPaymentStatus('pending');
            toast({ title: "STK Push Sent", description: `Check ${phone} to complete payment.` });
        } catch (error: any) {
            toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setStep('form');
        setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "" });
        setSelectedCategory("");
        setPaymentPhone("");
        setPaymentStatus('idle');
        setResourceId(null);
        setRegisteredMemberId(null);
        setRegisteredMemberName("");
    };

    const selectedCategoryData = categories.find(c => c.id === selectedCategory);

    // ─── STEP: DONE ──────────────────────────────────────────────────────────
    if (step === 'done') {
        return (
            <div className="max-w-lg mx-auto mt-16 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex justify-center">
                    <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center shadow-lg shadow-green-100">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-green-900">Member Activated!</h2>
                    <p className="text-muted-foreground mt-1">
                        <span className="font-semibold">{registeredMemberName}</span> has paid and is now fully active.
                    </p>
                </div>
                <Card className="border-green-200 bg-green-50/50 text-left">
                    <CardContent className="pt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Scheme</span>
                            <span className="font-semibold">{selectedCategoryData?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Coverage Balance</span>
                            <span className="font-semibold text-green-700">KES {selectedCategoryData?.benefit_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge className="bg-green-600 text-xs">Active & Covered</Badge>
                        </div>
                    </CardContent>
                </Card>
                <Button className="w-full btn-primary" onClick={handleReset}>
                    <Plus className="mr-2 h-4 w-4" /> Register Another Member
                </Button>
            </div>
        );
    }

    // ─── STEP: PAYMENT ───────────────────────────────────────────────────────
    if (step === 'payment') {
        return (
            <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Activate Coverage</h1>
                    <p className="text-muted-foreground">Send STK push to complete {registeredMemberName}'s registration.</p>
                </div>

                {/* Scheme Summary */}
                {selectedCategoryData && (
                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-blue-900">
                                <Star className="h-4 w-4 text-blue-600" />
                                Selected Scheme: {selectedCategoryData.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span className="text-slate-600">Base Premium</span>
                                <span className="font-mono">KES {selectedCategoryData.payment_amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span className="text-slate-600">Registration Fee</span>
                                <span className="font-mono">KES {selectedCategoryData.registration_fee.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span className="text-slate-600">Management Fee</span>
                                <span className="font-mono">KES {selectedCategoryData.management_fee.toLocaleString()}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <p className="text-xs uppercase text-blue-500 font-bold">Total to Pay</p>
                                    <p className="text-2xl font-mono font-bold text-blue-900">
                                        KES {(selectedCategoryData.payment_amount + selectedCategoryData.registration_fee + selectedCategoryData.management_fee).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-blue-500 font-bold">Coverage Added</p>
                                    <p className="text-2xl font-mono font-bold text-green-700">KES {selectedCategoryData.benefit_amount.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Phone input */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Smartphone className="h-4 w-4 text-blue-600" />
                            M-Pesa Number
                        </CardTitle>
                        <CardDescription>This will receive the STK push prompt.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">+</span>
                            <Input
                                type="tel"
                                placeholder="e.g. 0712345678"
                                className="pl-7 font-mono"
                                value={paymentPhone}
                                onChange={(e) => setPaymentPhone(e.target.value)}
                                disabled={paymentStatus === 'pending'}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Pre-filled from registration. Change if payer uses a different number.</p>
                    </CardContent>
                </Card>

                {/* Status panels */}
                {paymentStatus === 'pending' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col items-center gap-3 text-center animate-pulse">
                        <Smartphone className="h-10 w-10 text-amber-600" />
                        <div>
                            <p className="font-bold text-amber-900">Waiting for M-Pesa Confirmation...</p>
                            <p className="text-xs text-amber-700">
                                Check <span className="font-mono font-bold">{paymentPhone}</span> and enter M-Pesa PIN to complete
                            </p>
                        </div>
                        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                    </div>
                )}

                {paymentStatus === 'failed' && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
                        <div>
                            <p className="font-bold text-red-900 text-sm">Payment not completed.</p>
                            <p className="text-xs text-red-700">You can retry or the member can pay later via their portal.</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleReset} disabled={paymentStatus === 'pending'}>
                        Skip / Register Another
                    </Button>
                    <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleSendStkPush}
                        disabled={loading || paymentStatus === 'pending' || paymentStatus === 'success'}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                        Send STK Push
                    </Button>
                </div>
            </div>
        );
    }

    // ─── STEP: FORM ──────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div>
                <h1 className="text-3xl font-serif font-bold text-foreground">Add Member</h1>
                <p className="text-muted-foreground">Register a new member and select their membership scheme.</p>
            </div>

            <div className="card-elevated p-6">
                <form onSubmit={handleRegisterMember} className="space-y-6">
                    {/* Personal details */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <User className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Personal Details</h3>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name *</Label>
                                <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required placeholder="e.g. John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label>Email *</Label>
                                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required placeholder="e.g. john@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone (M-Pesa) *</Label>
                                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required placeholder="e.g. +254700000000" />
                            </div>
                            <div className="space-y-2">
                                <Label>ID Number *</Label>
                                <Input value={formData.idNumber} onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })} required placeholder="e.g. 12345678" />
                            </div>
                            <div className="space-y-2">
                                <Label>Age *</Label>
                                <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} required placeholder="e.g. 30" />
                            </div>
                            <div className="space-y-2">
                                <Label>Temporary Password *</Label>
                                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} placeholder="Min 6 characters" />
                            </div>
                        </div>
                    </div>

                    {/* Membership scheme selector */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Membership Scheme *</h3>
                        </div>
                        <div className="space-y-2">
                            <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a membership scheme..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            <span className="font-medium">{cat.name}</span>
                                            <span className="ml-2 text-muted-foreground text-xs">
                                                KES {(cat.payment_amount + cat.registration_fee + cat.management_fee).toLocaleString()} total → KES {cat.benefit_amount.toLocaleString()} coverage
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Selected scheme preview card */}
                            {selectedCategoryData && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg grid grid-cols-2 gap-3 text-sm animate-in fade-in duration-200">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-blue-500">Total Premium to Pay</p>
                                        <p className="font-bold text-blue-900 font-mono">KES {(selectedCategoryData.payment_amount + selectedCategoryData.registration_fee + selectedCategoryData.management_fee).toLocaleString()}</p>
                                        <p className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Base + Registration + Mgt</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-blue-500">Coverage Benefit</p>
                                        <p className="font-bold text-green-700 font-mono">KES {selectedCategoryData.benefit_amount.toLocaleString()}</p>
                                    </div>
                                    {selectedCategoryData.description && (
                                        <p className="col-span-2 text-[11px] text-muted-foreground italic">{selectedCategoryData.description}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button type="submit" className="w-full btn-primary mt-4" disabled={loading || !selectedCategory}>
                        {loading
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <ArrowRight className="mr-2 h-4 w-4" />
                        }
                        Register & Proceed to Payment
                    </Button>
                </form>
            </div>
        </div>
    );
}