import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Fingerprint, ArrowRight, Loader2, CheckCircle, ArrowLeft, Users, Activity, AlertTriangle, CreditCard } from "lucide-react";

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

export default function RegisterVisit() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [dependants, setDependants] = useState<any[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("");
    const [biometricsVerified, setBiometricsVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [receptionistBranchId, setReceptionistBranchId] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
    const [selectedDependant, setSelectedDependant] = useState<any>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [ongoingStages, setOngoingStages] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
    const [showPaymentHandler, setShowPaymentHandler] = useState(false);
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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;

        setSearching(true);
        setMember(null);
        setDependants([]);
        setSelectedPatientId("");
        setBiometricsVerified(false);

        try {
            // 1. Search Members (Principal)
            const { data: principalMatches, error: principalError } = await supabase
                .from("members")
                .select("*, membership_categories(name), branches(name)")
                .or(`phone.ilike."%${term}%",id_number.ilike."%${term}%",member_number.ilike."%${term}%",full_name.ilike."%${term}%"`);

            if (principalError) throw principalError;

            // 2. Search Dependants
            const { data: dependantMatches, error: dependantError } = await supabase
                .from("dependants")
                .select("member_id")
                .or(`full_name.ilike."%${term}%",id_number.ilike."%${term}%"`);

            if (dependantError) throw dependantError;

            // Collect all unique member IDs
            const foundMemberIds = new Set(principalMatches?.map(m => m.id) || []);
            const additionalMemberIds = (dependantMatches || [])
                .map(d => d.member_id)
                .filter(id => !foundMemberIds.has(id));

            let allResults = [...(principalMatches || [])];

            // If we found dependants whose principals aren't in the list, fetch them
            if (additionalMemberIds.length > 0) {
                const { data: extraMembers, error: extraError } = await supabase
                    .from("members")
                    .select("*, membership_categories(name), branches(name)")
                    .in("id", additionalMemberIds);

                if (!extraError && extraMembers) {
                    allResults = [...allResults, ...extraMembers];
                }
            }

            if (allResults.length > 1) {
                setSearchResults(allResults);
                setSelectionDialogOpen(true);
            } else if (allResults.length === 1) {
                handleSelectMember(allResults[0]);
            } else {
                toast({ title: "Member not found", description: "No member found matching that criteria.", variant: "destructive" });
            }
        } catch (error: any) {
            console.error("Search error:", error);
            toast({ title: "Search failed", description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const handleSelectMember = async (data: any) => {
        setMember(data);
        setSelectedPatientId(data.id);
        setSelectionDialogOpen(false);

        // Fetch dependants
        const { data: dependantsData } = await supabase
            .from("dependants")
            .select("*")
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
        if (!member) return;
        try {
            const { error } = await supabase
                .from("members")
                .update({ biometric_data: credentialData })
                .eq("id", member.id);
            if (error) throw error;

            setMember({ ...member, biometric_data: credentialData });
            setBiometricsVerified(true);
            toast({ title: "Success", description: "Biometrics registered and verified." });
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
            toast({ title: "Biometrics required", description: "Please verify principal member identity first.", variant: "destructive" });
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
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <Input
                            placeholder="Name, Phone, ID, or Member #"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="submit" disabled={searching}>
                            {searching ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Search</span>
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {member && (
                <div className="space-y-6">
                    <Card className="border-primary/50">
                        <CardHeader className="bg-primary/5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{member.full_name}</CardTitle>
                                    <CardDescription>Principal Member #{member.member_number}</CardDescription>
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
                                                            <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-2">
                                                                <img
                                                                    src={dep.image_url}
                                                                    alt={dep.full_name}
                                                                    className="h-14 w-11 object-cover rounded border"
                                                                />
                                                                <div className="text-xs text-muted-foreground">ID photo on file</div>
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
                                {member.biometric_data ? (
                                    <BiometricCapture
                                        mode="verify"
                                        userId={member.id}
                                        credentialId={member.biometric_data}
                                        onVerificationComplete={handleBiometricVerificationComplete}
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 border rounded-lg bg-yellow-50/20 text-yellow-700 flex items-center gap-3 border-yellow-200">
                                            <Fingerprint className="h-6 w-6 shrink-0" />
                                            <div>
                                                <p className="font-medium">No Biometric Data Found</p>
                                                <p className="text-xs font-medium">To proceed, you MUST capture the principal member's biometric data now.</p>
                                            </div>
                                        </div>
                                        <BiometricCapture
                                            mode="register"
                                            userId={member.id}
                                            userName={member.full_name}
                                            onCaptureComplete={handleBiometricCaptureComplete}
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Assign Doctor (Optional)</Label>
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
                                    <p className="text-xs text-muted-foreground">If not selected, the first available doctor will pick it up.</p>
                                </div>

                                <Button
                                    className="w-full btn-primary"
                                    size="lg"
                                    disabled={!biometricsVerified || loading || !receptionistId || !receptionistBranchId}
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
                                        <p className="font-medium">{selectedDependant.id_number}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={selectionDialogOpen} onOpenChange={setSelectionDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Select Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">Multiple matches found. Please select the correct member.</p>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {searchResults.map((m) => (
                                <div
                                    key={m.id}
                                    className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors flex justify-between items-center group"
                                    onClick={() => handleSelectMember(m)}
                                >
                                    <div>
                                        <div className="font-bold group-hover:text-primary transition-colors">{m.full_name}</div>
                                        <div className="text-xs text-muted-foreground">#{m.member_number} • {m.phone} • {m.id_number}</div>
                                        <div className="text-[10px] mt-1 text-primary/70">{m.membership_categories?.name} @ {m.branches?.name}</div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}