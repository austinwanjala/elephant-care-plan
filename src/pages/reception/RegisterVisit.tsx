import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Fingerprint, ArrowRight, Loader2, CheckCircle, ArrowLeft, Users, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { BiometricCapture } from "@/components/BiometricCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
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
            // 1. Get all active staff in this branch
            const { data: branchStaff, error: staffError } = await supabase
                .from("staff")
                .select("id, full_name, user_id")
                .eq("branch_id", receptionistBranchId)
                .eq("is_active", true);

            if (staffError) throw staffError;

            if (!branchStaff || branchStaff.length === 0) {
                setDoctors([]);
                return;
            }

            // 2. Filter these staff to check who has the 'doctor' role
            const staffUserIds = branchStaff.map(s => s.user_id);
            const { data: doctorRoles, error: roleError } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "doctor")
                .in("user_id", staffUserIds);

            if (roleError) throw roleError;

            const doctorUserIdSet = new Set(doctorRoles?.map(r => r.user_id));
            const doctorsList = branchStaff.filter(s => doctorUserIdSet.has(s.user_id));

            setDoctors(doctorsList);
        } catch (error: any) {
            console.error("Error fetching doctors:", error);
            toast({ title: "Error", description: "Failed to load doctors list.", variant: "destructive" });
        }
    };

    const [activeStages, setActiveStages] = useState<any[]>([]);

    const fetchActiveStages = async (memberId: string) => {
        const { data } = await (supabase as any)
            .from("service_stages")
            .select("*, services(name, stage_names, total_stages)")
            .eq("member_id", memberId)
            .eq("status", "in_progress");

        if (data) setActiveStages(data);
        else setActiveStages([]);
    };

    // Returns stages for a given patient (principal or dependant)
    const getStagesForPatient = (patientId: string) => {
        if (!member) return [];
        if (patientId === member.id) {
            // Principal member: stages with no dependant
            return activeStages.filter(s => s.member_id === member.id && !s.dependant_id);
        } else {
            // Dependant: stages assigned to that dependant
            return activeStages.filter(s => s.member_id === member.id && s.dependant_id === patientId);
        }
    };

    const loadMemberData = async (data: any) => {
        setMember(data);
        setSelectedPatientId(data.id);
        setMemberSearchResults([]); // clear search results list
        fetchActiveStages(data.id);

        const { data: dependantsData } = await supabase
            .from("dependants")
            .select("*")
            .eq("member_id", data.id)
            .eq("is_active", true);

        if (dependantsData) setDependants(dependantsData);

        if (data.biometric_data) {
            setBiometricsVerified(false);
        } else {
            setBiometricsVerified(true);
            toast({ title: "No Biometric Data", description: "Principal member has no registered biometric data. Proceeding without biometric verification.", variant: "default" });
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
        setActiveStages([]);
        setMemberSearchResults([]);

        try {
            const { data, error } = await supabase
                .from("members")
                .select("*, membership_categories(name), branches(name)")
                .or(`phone.ilike."%${term}%",id_number.ilike."%${term}%",member_number.ilike."%${term}%",full_name.ilike."%${term}%"`);

            if (error) throw error;

            if (!data || data.length === 0) {
                toast({ title: "Member not found", description: "No member found matching that criteria.", variant: "destructive" });
            } else if (data.length === 1) {
                // Exactly one result — load directly
                await loadMemberData(data[0]);
            } else {
                // Multiple results — let receptionist pick
                setMemberSearchResults(data);
                toast({ title: `${data.length} members found`, description: "Please select the correct member from the list below." });
            }
        } catch (error: any) {
            toast({ title: "Search failed", description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
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
                doctor_id: selectedDoctorId || null, // Assign doctor if selected
                biometrics_verified: biometricsVerified, // We verified the principal
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0
            }]);

            if (error) throw error;

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

            {/* Multiple members picker */}
            {memberSearchResults.length > 1 && !member && (
                <Card className="border-amber-300">
                    <CardHeader className="bg-amber-50">
                        <CardTitle className="flex items-center gap-2 text-amber-900">
                            <Users className="h-5 w-5" />
                            {memberSearchResults.length} Members Found — Select the Correct One
                        </CardTitle>
                        <CardDescription className="text-amber-700">
                            Multiple members match your search. Click "Select" on the right patient to proceed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="space-y-3">
                            {memberSearchResults.map((result) => (
                                <div
                                    key={result.id}
                                    className="flex items-center justify-between gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                                        <div>
                                            <p className="font-bold text-foreground">{result.full_name}</p>
                                            <p className="text-xs text-muted-foreground">#{result.member_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">ID</p>
                                            <p className="font-medium">{result.id_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Phone</p>
                                            <p className="font-medium">{result.phone}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={result.is_active ? "default" : "destructive"} className="text-xs">
                                                {result.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{result.membership_categories?.name || "N/A"}</span>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => loadMemberData(result)}
                                    >
                                        <ArrowRight className="h-4 w-4 mr-1" /> Select
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

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

                            {!member.is_active && (
                                <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
                                    <UserX className="h-5 w-5" />
                                    <span className="font-medium">Member is inactive. Advise payment before service.</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {member.is_active && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Select Patient</CardTitle>
                                <CardDescription>Who is receiving treatment today?</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <RadioGroup value={selectedPatientId} onValueChange={setSelectedPatientId} className="grid grid-cols-1 gap-4">
                                    {/* Principal Member */}
                                    <div className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${selectedPatientId === member.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                                        <RadioGroupItem value={member.id} id={member.id} />
                                        <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg">{member.full_name}</span>
                                                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600">Principal</Badge>
                                                {getStagesForPatient(member.id).length > 0 && (
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {getStagesForPatient(member.id).map(s => (
                                                            <Badge key={s.id} className="bg-blue-600 text-white animate-pulse shadow-sm font-black text-[11px] px-3 py-1 uppercase tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                                                                <div className="h-2 w-2 rounded-full bg-white/80" />
                                                                {s.services?.name || 'Procedure'}: Stage {s.current_stage}/{s.total_stages || s.services?.total_stages || '?'}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Label>
                                    </div>

                                    {/* Dependants */}
                                    {dependants.map((dep) => (
                                        <div key={dep.id} className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${selectedPatientId === dep.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                                            <RadioGroupItem value={dep.id} id={dep.id} />
                                            <Label htmlFor={dep.id} className="flex-1 cursor-pointer">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{dep.full_name}</span>
                                                    </div>
                                                    {getStagesForPatient(dep.id).length > 0 && (
                                                        <div className="flex gap-1 flex-wrap mt-1">
                                                            {getStagesForPatient(dep.id).map(s => (
                                                                <Badge key={s.id} className="bg-blue-600 text-white animate-pulse shadow-sm font-black text-[11px] px-3 py-1 uppercase tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                                                                    <div className="h-2 w-2 rounded-full bg-white/80" />
                                                                    {s.services?.name || 'Procedure'}: Stage {s.current_stage}/{s.total_stages || s.services?.total_stages || '?'}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-sm font-medium text-slate-500">{dep.relationship} • {dep.id_number}</div>
                                            </Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setSelectedDependant(dep);
                                                    setDetailsDialogOpen(true);
                                                }}
                                            >
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    ))}
                                </RadioGroup>

                                {/* Per-patient active stage detail banner */}
                                {selectedPatientId && getStagesForPatient(selectedPatientId).length > 0 && (
                                    <div className="p-5 border-2 border-blue-200 bg-blue-50/50 rounded-2xl space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2 text-blue-900 font-black uppercase tracking-wider text-xs">
                                            <Info className="h-4 w-4" />
                                            Ongoing Multi-Stage Treatment Detected
                                        </div>
                                        <div className="space-y-2">
                                            {getStagesForPatient(selectedPatientId).map(s => (
                                                <div key={s.id} className="bg-white p-3 rounded-xl border border-blue-100 flex justify-between items-center group">
                                                    <div className="flex flex-col">
                                                        <span className="font-extrabold text-slate-900 leading-tight">
                                                            {s.services?.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {s.tooth_number ? `Tooth #${s.tooth_number}` : 'General Procedure'}
                                                            {s.services?.stage_names?.[s.current_stage - 1] && ` • Completed ${s.services.stage_names[s.current_stage - 1]}`}
                                                        </span>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        <Badge className="bg-blue-600 text-white font-bold px-3">
                                                            Stage {s.current_stage} of {s.total_stages}
                                                        </Badge>
                                                        {s.current_stage < s.total_stages && (
                                                            <span className="text-[9px] text-blue-600 font-bold mt-1 uppercase tracking-tighter">
                                                                Awaiting {s.services?.stage_names?.[s.current_stage] ? `Next: ${s.services.stage_names[s.current_stage]}` : `Stage ${s.current_stage + 1}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-2 border-t border-blue-200/50 flex items-center gap-2 text-blue-700 font-medium text-xs italic">
                                            <CheckCircle className="h-3 w-3" />
                                            No new charges will be applied for these treatments today.
                                        </div>
                                    </div>
                                )}
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
                                    <div className="p-4 border rounded-lg bg-yellow-50/20 text-yellow-700 flex items-center gap-3">
                                        <Fingerprint className="h-6 w-6 shrink-0" />
                                        <div>
                                            <p className="font-medium">No Biometric Data Registered</p>
                                            <p className="text-xs">Proceeding without biometric verification. Consider capturing biometrics for this member in Admin portal.</p>
                                        </div>
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
        </div>
    );
}