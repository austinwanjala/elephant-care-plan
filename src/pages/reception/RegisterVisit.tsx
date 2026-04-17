import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Fingerprint, ArrowRight, Loader2, CheckCircle, ArrowLeft, Users, Activity, AlertTriangle, CreditCard, ShieldCheck, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { BiometricCapture } from "@/components/BiometricCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InsufficientBalanceHandler } from "@/components/reception/InsufficientBalanceHandler";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const getVerificationPhoto = (biometricData: any, imageUrlFallback: any) => {
    if (biometricData) {
        try {
            const parsed = typeof biometricData === 'string' ? JSON.parse(biometricData) : biometricData;
            if (parsed?.face_template) return parsed.face_template;
        } catch {
            // ignore JSON parse errors
        }
    }
    return imageUrlFallback || null;
};

export default function RegisterVisit() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [dependants, setDependants] = useState<any[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("");
    const [biometricsVerified, setBiometricsVerified] = useState(true);
    const [loading, setLoading] = useState(false);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [receptionistBranchId, setReceptionistBranchId] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
    const [selectedDependant, setSelectedDependant] = useState<any>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [ongoingStages, setOngoingStages] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
    const [showPaymentHandler, setShowPaymentHandler] = useState(false);
    const [showBiometrics, setShowBiometrics] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchReceptionistInfo();
    }, []);

    useEffect(() => {
        if (receptionistBranchId) {
            fetchDoctors();
        }
    }, [receptionistBranchId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 1) {
                performSearch(searchTerm);
            } else if (searchTerm.trim().length === 0) {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchReceptionistInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("id, branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData) {
            toast({ title: "Error", description: "Could not retrieve receptionist profile.", variant: "destructive" });
            navigate("/reception");
            return;
        }
        setReceptionistId(staffData.id);
        setReceptionistBranchId(staffData.branch_id);
    };

    const fetchDoctors = async () => {
        try {
            if (!receptionistBranchId) {
                setDoctors([]);
                return;
            }

            // IMPORTANT: user_roles has hardened RLS (self-read), so we must use the SECURITY DEFINER RPC.
            const { data, error } = await (supabase as any).rpc("get_branch_doctors", {
                branch_id_input: receptionistBranchId,
            });

            if (error) throw error;

            setDoctors(data || []);
        } catch (error: any) {
            console.error("Error fetching doctors:", error);
            toast({ title: "Error", description: "Failed to load doctors list.", variant: "destructive" });
        }
    };

    const sanitizeSearchTerm = (raw: string) => raw.replace(/[(),]/g, " ").replace(/"/g, "").trim();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchTerm);
    };

    const performSearch = async (query: string) => {
        const term = query.trim();
        if (!term) return;

        const safeTerm = sanitizeSearchTerm(term);
        if (!safeTerm) return;

        setSearching(true);

        try {
            // 1. Search Members (Principal)
            const { data: principalMatches, error: principalError } = await supabase
                .from("members")
                .select("id, full_name, phone, id_number, member_number, biometric_data, image_url, is_active, coverage_balance, membership_categories(name), branches(name)")
                .or(
                    `phone.ilike.*${safeTerm}*,id_number.ilike.*${safeTerm}*,member_number.ilike.*${safeTerm}*,full_name.ilike.*${safeTerm}*`
                )
                .limit(10);

            if (principalError) throw principalError;

            // 2. Search Dependants
            const { data: dependantMatches, error: dependantError } = await supabase
                .from("dependants")
                .select("member_id")
                .or(`full_name.ilike.*${safeTerm}*,id_number.ilike.*${safeTerm}*`)
                .limit(10);

            if (dependantError) throw dependantError;

            // Collect all unique member IDs
            const foundIds = new Set(principalMatches?.map(m => m.id) || []);
            const additionalIds = (dependantMatches || [])
                .map(d => d.member_id)
                .filter(id => !foundIds.has(id));

            let allResults = [...(principalMatches || [])];

            if (additionalIds.length > 0) {
                const { data: extraMembers } = await supabase
                    .from("members")
                    .select("id, full_name, phone, id_number, member_number, biometric_data, image_url, is_active, coverage_balance, membership_categories(name), branches(name)")
                    .in("id", additionalIds);

                if (extraMembers) {
                    allResults = [...allResults, ...extraMembers];
                }
            }

            setSearchResults(allResults);
            if (allResults.length === 0 && query === searchTerm) {
               // Only toast if it was a manual search or we're sure
            }
        } catch (error: any) {
            console.error("Search error:", error);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectMember = async (data: any) => {
        setMember(data);
        setSelectedPatientId(data.id);
        setSelectionDialogOpen(false);
        setSearchResults([]);
        setSearchTerm(""); // Clear search after selection
        setShowBiometrics(false); // Reset biometric view

        // Fetch dependants
        const { data: dependantsData } = await supabase
            .from("dependants")
            .select("*, biometric_data")
            .eq("member_id", data.id)
            .eq("is_active", true);

        if (dependantsData) {
            setDependants(dependantsData);
        }

        // Fetch ongoing multi-stage treatments
        const { data: rawStages } = await (supabase as any)
            .from("service_stages")
            .select("*")
            .eq("member_id", data.id)
            .eq("status", "in_progress");

        if (rawStages && rawStages.length > 0) {
            const serviceIds = [...new Set(rawStages.map((s: any) => s.service_id))];
            const { data: servicesData } = await (supabase as any)
                .from("services")
                .select("id, name")
                .in("id", serviceIds);
            const servicesMap: Record<string, any> = {};
            (servicesData || []).forEach((svc: any) => { servicesMap[svc.id] = svc; });
            setOngoingStages(rawStages.map((s: any) => ({ ...s, serviceName: servicesMap[s.service_id]?.name || 'Unknown Service' })));
        } else {
            setOngoingStages([]);
        }

        if (data.biometric_data) {
            setBiometricsVerified(false);
        } else {
            setBiometricsVerified(false); // Force verification even if no data (will need capture)
        }
    };

    const handleBiometricCaptureComplete = async (credentialData: string) => {
        if (!selectedPatientId) return;
        const isDep = selectedPatientId !== member?.id;
        const table = isDep ? "dependants" : "members";
        
        try {
            const { error } = await supabase
                .from(table)
                .update({ biometric_data: credentialData })
                .eq("id", selectedPatientId);
            if (error) throw error;

            if (isDep) {
                setDependants(prev => prev.map(d => d.id === selectedPatientId ? { ...d, biometric_data: credentialData } : d));
            } else {
                setMember((prev: any) => ({ ...prev, biometric_data: credentialData }));
            }
            
            setBiometricsVerified(true);
            toast({ title: "Success", description: "Biometrics registered and saved to patient profile." });
        } catch (error: any) {
            toast({ title: "Capture failed", description: error.message, variant: "destructive" });
        }
    };

    const handleBiometricVerificationComplete = (success: boolean) => {
        setBiometricsVerified(success);
        if (!success) {
            toast({ title: "Biometric Verification Failed", description: "Please try again or proceed manually if allowed.", variant: "destructive" });
        }
    };

    const handleRegisterVisit = async () => {
        if (!member || !receptionistId || !receptionistBranchId) return;
        if (!biometricsVerified) {
            toast({ title: "Biometrics required", description: "Please verify patient identity first.", variant: "destructive" });
            return;
        }
        if (!member.is_active) {
            toast({ title: "Inactive Member", description: "Member is inactive. Advise payment before service.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const isDependant = selectedPatientId !== member.id;
            const dependantId = isDependant ? selectedPatientId : null;

            // Block: Restrict same member/dependant registration twice a day
            const todayStr = new Date().toISOString().split('T')[0];
            let checkQuery = supabase
                .from('visits')
                .select('id')
                .eq('member_id', member.id)
                .gte('created_at', todayStr)
                .neq('status', 'cancelled'); // Don't block if previous was cancelled? User didn't specify, but usually good.

            if (dependantId) {
                checkQuery = checkQuery.eq('dependant_id', dependantId);
            } else {
                checkQuery = checkQuery.is('dependant_id', null);
            }

            const { data: existingVisit } = await checkQuery.maybeSingle();

            if (existingVisit) {
                toast({
                    title: "Registration Restricted",
                    description: "This patient has already been registered for a visit today. Duplicate registrations are not allowed.",
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            // Verify if dependant is valid (double check)
            if (isDependant) {
                const selectedDependant = dependants.find(d => d.id === selectedPatientId);
                if (!selectedDependant) {
                    throw new Error("Invalid patient selected.");
                }
            }

            const { error } = await supabase.from('visits').insert([{
                member_id: member.id,
                dependant_id: dependantId,
                branch_id: receptionistBranchId,
                receptionist_id: receptionistId,
                status: 'registered',
                doctor_id: selectedDoctorId || null,
                assigned_doctor_id: selectedDoctorId || null,
                biometrics_verified: true,
                biometric_verified_at: new Date().toISOString(),
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0
            }]);

            if (error) throw error;

            // Log biometric verification
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from("system_logs").insert({
                action: "VISIT_BIOMETRIC_VERIFIED",
                user_id: user?.id,
                details: {
                    member_id: member.id,
                    patient_id: selectedPatientId,
                    timestamp: new Date().toISOString()
                }
            });

            toast({ title: "Visit Registered", description: `${isDependant ? 'Dependant' : 'Member'} is now in the queue for the doctor.` });
            navigate("/reception");
        } catch (error: any) {
            toast({ title: "Registration failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/reception">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Register New Visit</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Member Search</CardTitle>
                    <CardDescription>Enter Name, Phone, ID, or Member Number to find the member.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Type Name, Phone, ID, or Member # to search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-inner"
                                />
                                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                            </div>
                            <Button type="submit" disabled={searching} className="h-11 px-6 shadow-md transition-transform hover:scale-105 active:scale-95">
                                Search 
                            </Button>
                        </form>

                        {(searchResults.length > 0 || searching) && searchTerm.trim().length >= 1 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.2)] border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                                    {searching && searchResults.length === 0 && (
                                        <div className="p-8 text-center text-slate-400">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                                            <p className="text-xs font-medium animate-pulse">Searching for "{searchTerm}"...</p>
                                        </div>
                                    )}
                                    
                                    {!searching && searchResults.length === 0 && searchTerm.trim().length >= 1 && (
                                        <div className="p-8 text-center text-slate-400">
                                            <Search className="h-6 w-6 mx-auto mb-2 opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No members found</p>
                                            <p className="text-[10px] mt-1">Try a different name, phone or ID</p>
                                        </div>
                                    )}

                                    {searchResults.map((m) => (
                                        <div
                                            key={m.id}
                                            className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                                            onClick={() => handleSelectMember(m)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {getVerificationPhoto(m.biometric_data, m.image_url) ? (
                                                    <img src={getVerificationPhoto(m.biometric_data, m.image_url)} alt={m.full_name} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {m.full_name.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-slate-900 leading-none group-hover:text-primary transition-colors">{m.full_name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                                                        <span>#{m.member_number}</span>
                                                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                        <span>{m.phone}</span>
                                                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                        <span>{m.id_number}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors mr-2" />
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                        {searching ? "Searching..." : `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'} found`}
                                    </span>
                                    <button onClick={() => setSearchResults([])} className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider">Close</button>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {member && (
                <div className="space-y-6">
                    <Card className="border-primary/50">
                        <CardHeader className="bg-primary/5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    {getVerificationPhoto(member.biometric_data, member.image_url) ? (
                                        <div 
                                            className="h-14 w-14 rounded-full overflow-hidden border-2 border-primary/20 shadow-sm shrink-0 cursor-pointer hover:border-primary transition-colors"
                                            onClick={() => setExpandedImage(getVerificationPhoto(member.biometric_data, member.image_url))}
                                        >
                                            <img src={getVerificationPhoto(member.biometric_data, member.image_url)} alt={member.full_name} className="h-full w-full object-cover hover:scale-110 transition-transform duration-300" />
                                        </div>
                                    ) : (
                                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                                            {member.full_name.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <CardTitle>{member.full_name}</CardTitle>
                                        <CardDescription>Principal Member #{member.member_number}</CardDescription>
                                    </div>
                                </div>
                                <Badge variant={member.is_active ? "default" : "destructive"}>
                                    {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-muted-foreground">Phone</Label>
                                    <p className="font-medium">{member.phone}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">ID Number</Label>
                                    <p className="font-medium">{member.id_number}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Coverage Balance</Label>
                                    <p className="font-medium text-primary">KES {member.coverage_balance?.toLocaleString()}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Membership</Label>
                                    <p className="font-medium">{member.membership_categories?.name || "N/A"}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Assigned Branch</Label>
                                    <p className="font-medium">{member.branches?.name || "N/A"}</p>
                                </div>
                            </div>

                            {!member.is_active && !showPaymentHandler && (
                                <div className="bg-destructive/10 text-destructive p-4 rounded-md flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <UserX className="h-5 w-5" />
                                        <span className="font-bold uppercase">Inactive Member - Renewal Required</span>
                                    </div>
                                    <p className="text-sm">The member account is currently inactive. Please renew their scheme or top up to proceed with registration.</p>
                                    <Button
                                        variant="destructive"
                                        className="w-full bg-red-600 hover:bg-red-700"
                                        onClick={() => setShowPaymentHandler(true)}
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Renew or Top-up Account
                                    </Button>
                                </div>
                            )}

                            {showPaymentHandler && (
                                <InsufficientBalanceHandler
                                    member={member}
                                    requiredAmount={0} // 0 because we just want them to be active
                                    onPaymentSuccess={async () => {
                                        setShowPaymentHandler(false);
                                        // Re-fetch member to get active status
                                        handleSelectMember(member);
                                        toast({ title: "Account Activated", description: "The member is now active." });
                                    }}
                                    onCancel={() => setShowPaymentHandler(false)}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {member.is_active && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Select Patient</CardTitle>
                                <CardDescription>Who is receiving treatment today? Select to see their status.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RadioGroup value={selectedPatientId} onValueChange={setSelectedPatientId} className="space-y-3">

                                    {/* ── Principal Member ── */}
                                    {(() => {
                                        const isSelected = selectedPatientId === member.id;
                                        const principalStages = ongoingStages.filter((s: any) => !s.dependant_id);

                                        return (
                                            <div className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/40 hover:bg-muted/30'
                                                }`}>
                                                {/* Radio Row */}
                                                <div
                                                    className="flex items-center gap-3 p-4 cursor-pointer"
                                                    onClick={() => setSelectedPatientId(member.id)}
                                                >
                                                    <RadioGroupItem value={member.id} id={`radio-${member.id}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-base">{member.full_name}</span>
                                                            <Badge variant="outline" className="text-xs">Principal</Badge>
                                                            <Badge variant={member.is_active ? 'default' : 'destructive'} className="text-xs">
                                                                {member.is_active ? 'Active' : 'Inactive'}
                                                            </Badge>
                                                            {principalStages.length > 0 && (
                                                                <Badge className="text-xs bg-blue-600">
                                                                    {principalStages.length} Ongoing
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{member.id_number} • {member.phone}</p>
                                                    </div>
                                                </div>

                                                {/* Status Panel — shown when selected */}
                                                {isSelected && (
                                                    <div className="border-t bg-white/70 px-4 py-3 space-y-3">
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Coverage Balance</p>
                                                                <p className="font-bold text-primary text-base">KES {member.coverage_balance?.toLocaleString() || 0}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Scheme</p>
                                                                <p className="font-medium">{member.membership_categories?.name || 'N/A'}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Branch</p>
                                                                <p className="font-medium">{member.branches?.name || 'N/A'}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Member #</p>
                                                                <p className="font-medium">{member.member_number}</p>
                                                            </div>
                                                        </div>

                                                        {/* Ongoing treatments for principal */}
                                                        {principalStages.length > 0 && (
                                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Activity className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                                                                    <span className="text-xs font-black text-blue-900 uppercase tracking-wide">Ongoing Treatments</span>
                                                                </div>
                                                                {principalStages.map((s: any) => (
                                                                    <div key={s.id} className="flex items-center justify-between bg-white rounded border border-blue-100 px-2.5 py-1.5">
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-blue-900">{s.serviceName}</p>
                                                                            {s.tooth_number && <p className="text-[10px] text-blue-500">Tooth #{s.tooth_number}</p>}
                                                                        </div>
                                                                        <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                                            Stage {s.current_stage}/{s.total_stages}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                <p className="text-[10px] text-blue-600 font-medium">↳ Follow-up visit — no new charges</p>
                                                            </div>
                                                        )}

                                                        {!member.is_active && (
                                                            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg font-medium">
                                                                <UserX className="h-3.5 w-3.5 shrink-0" />
                                                                Member inactive — advise payment before service
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* ── Dependants ── */}
                                    {dependants.map((dep) => {
                                        const isSelected = selectedPatientId === dep.id;
                                        const depStages = ongoingStages.filter((s: any) => s.dependant_id === dep.id);
                                        const age = dep.dob
                                            ? Math.floor((Date.now() - new Date(dep.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                                            : null;

                                        return (
                                            <div
                                                key={dep.id}
                                                className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/40 hover:bg-muted/30'
                                                    }`}
                                            >
                                                {/* Radio Row */}
                                                <div
                                                    className="flex items-center gap-3 p-4 cursor-pointer"
                                                    onClick={() => setSelectedPatientId(dep.id)}
                                                >
                                                    <RadioGroupItem value={dep.id} id={`radio-${dep.id}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-base">{dep.full_name}</span>
                                                            <Badge variant="outline" className="text-xs capitalize">{dep.relationship}</Badge>
                                                            <Badge variant="secondary" className="text-xs">Covered</Badge>
                                                            {depStages.length > 0 && (
                                                                <Badge className="text-xs bg-blue-600">
                                                                    {depStages.length} Ongoing
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {dep.id_number}{age !== null ? ` • ${age} yrs` : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Status Panel — shown when selected */}
                                                {isSelected && (
                                                    <div className="border-t bg-white/70 px-4 py-3 space-y-3">
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Coverage</p>
                                                                <p className="font-bold text-primary text-base">KES {member.coverage_balance?.toLocaleString() || 0}</p>
                                                                <p className="text-[10px] text-muted-foreground">Shared from principal</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Date of Birth</p>
                                                                <p className="font-medium">
                                                                    {dep.dob ? new Date(dep.dob).toLocaleDateString() : 'N/A'}
                                                                    {age !== null && <span className="text-muted-foreground text-xs ml-1">({age} yrs)</span>}
                                                                </p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">ID / Birth Cert</p>
                                                                <p className="font-medium">{dep.id_number}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Relationship</p>
                                                                <p className="font-medium capitalize">{dep.relationship}</p>
                                                            </div>
                                                        </div>

                                                        {/* Dependant photo if available */}
                                                        {dep.image_url && (
                                                            <div 
                                                                className="flex items-center gap-3 bg-muted/30 rounded-lg p-2 cursor-pointer group hover:bg-muted/50 transition-colors"
                                                                onClick={() => setExpandedImage(dep.image_url)}
                                                            >
                                                                <img
                                                                    src={dep.image_url}
                                                                    alt={dep.full_name}
                                                                    className="h-14 w-11 object-cover rounded border shadow-sm group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Click to expand ID photo</div>
                                                            </div>
                                                        )}

                                                        {/* Ongoing treatments for this dependant */}
                                                        {depStages.length > 0 && (
                                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Activity className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                                                                    <span className="text-xs font-black text-blue-900 uppercase tracking-wide">Ongoing Treatments</span>
                                                                </div>
                                                                {depStages.map((s: any) => (
                                                                    <div key={s.id} className="flex items-center justify-between bg-white rounded border border-blue-100 px-2.5 py-1.5">
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-blue-900">{s.serviceName}</p>
                                                                            {s.tooth_number && <p className="text-[10px] text-blue-500">Tooth #{s.tooth_number}</p>}
                                                                        </div>
                                                                        <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                                            Stage {s.current_stage}/{s.total_stages}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                <p className="text-[10px] text-blue-600 font-medium">↳ Follow-up visit — no new charges</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            </CardContent>
                        </Card>
                    )}

                    {member.is_active && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Authorization & Assignment</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {(() => {
                                    const activePatient = selectedPatientId === member?.id 
                                        ? member 
                                        : dependants.find(d => d.id === selectedPatientId);
                                    
                                    if (!activePatient) return null;
                                    const bioData = activePatient.biometric_data;
                                    const isDep = selectedPatientId !== member?.id;

                                    return showBiometrics ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                    Live Facial Recognition
                                                </h4>
                                                <Button variant="ghost" size="sm" onClick={() => setShowBiometrics(false)} className="text-xs text-slate-500">Cancel</Button>
                                            </div>
                                            {bioData ? (
                                                <BiometricCapture
                                                    mode="verify"
                                                    userId={activePatient.id}
                                                    credentialId={bioData}
                                                    targetTable={isDep ? 'dependants' : 'members'}
                                                    onVerificationComplete={handleBiometricVerificationComplete}
                                                />
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="p-4 border rounded-lg bg-yellow-50/20 text-yellow-700 flex items-center gap-3 border-yellow-200 shadow-sm border-dashed">
                                                        <Fingerprint className="h-6 w-6 shrink-0" />
                                                        <div className="text-xs">
                                                            <p className="font-bold uppercase tracking-wide">First-Time Enrollment</p>
                                                            <p>No Face ID on record for this {isDep ? 'dependant' : 'member'}. Enroll their biometric profile now to authorize this visit.</p>
                                                        </div>
                                                    </div>
                                                    <BiometricCapture
                                                        mode="register"
                                                        userId={activePatient.id}
                                                        userName={activePatient.full_name}
                                                        targetTable={isDep ? 'dependants' : 'members'}
                                                        onCaptureComplete={handleBiometricCaptureComplete}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed rounded-xl bg-slate-50/50 hover:bg-white transition-all group">
                                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                <ShieldCheck className="h-8 w-8" />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="font-bold text-slate-900 italic">Identity Verification Required</h3>
                                                <p className="text-xs text-slate-500 mt-1">Please confirm the {isDep ? "dependant's" : "principal member's"} identity before proceeding.</p>
                                            </div>
                                            <Button 
                                                onClick={() => setShowBiometrics(true)}
                                                className="px-8 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 rounded-full h-11"
                                            >
                                                {bioData ? (
                                                    <><UserCheck className="mr-2 h-4 w-4" /> Verify Face ID</>
                                                ) : (
                                                    <><UserCheck className="mr-2 h-4 w-4" /> Enroll for Face ID</>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                })()}

                                <div className="space-y-2">
                                    <Label>Assign Doctor <span className="text-destructive">*</span></Label>
                                    <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a doctor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {doctors.map((doc) => (
                                                <SelectItem key={doc.id} value={doc.id}>{doc.full_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground italic">Doctors can only view patients specifically allocated to them by reception.</p>
                                </div>

                                <Button
                                    className="w-full btn-primary"
                                    size="lg"
                                    disabled={loading || !receptionistId || !receptionistBranchId || !selectedDoctorId}
                                    onClick={handleRegisterVisit}
                                >
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <UserCheck className="mr-2 h-5 w-5" />}
                                    Register Visit
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dependant Details</DialogTitle>
                    </DialogHeader>
                    {selectedDependant && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="h-40 w-32 bg-muted rounded-md overflow-hidden border relative">
                                {selectedDependant.image_url ? (
                                    <img
                                        src={selectedDependant.image_url}
                                        alt={selectedDependant.full_name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-muted">
                                        <Users className="h-12 w-12 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>
                            <div className="text-center space-y-2 w-full">
                                <h3 className="text-xl font-bold">{selectedDependant.full_name}</h3>
                                <Badge>{selectedDependant.relationship}</Badge>

                                <div className="grid grid-cols-2 gap-4 text-sm text-left mt-4 w-full border-t pt-4">
                                    <div>
                                        <Label className="text-muted-foreground">Date of Birth</Label>
                                        <p className="font-medium">
                                            {new Date(selectedDependant.dob).toLocaleDateString()}
                                            <span className="text-muted-foreground ml-1">
                                                ({Math.abs(new Date(Date.now() - new Date(selectedDependant.dob).getTime()).getUTCFullYear() - 1970)} yrs)
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">ID / Birth Cert</Label>
                                        <p className="font-medium capitalize">{selectedDependant.relationship}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!expandedImage} onOpenChange={(open) => !open && setExpandedImage(null)}>
                <DialogContent className="max-w-3xl border-none bg-transparent shadow-none p-0 overflow-hidden flex justify-center items-center">
                    {expandedImage && (
                        <div className="relative rounded-xl overflow-hidden bg-black/90 p-2 shadow-2xl border border-white/10">
                            <img 
                                src={expandedImage} 
                                alt="Expanded view" 
                                className="max-w-full max-h-[85vh] object-contain rounded-lg" 
                            />
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg pointer-events-none"></div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
