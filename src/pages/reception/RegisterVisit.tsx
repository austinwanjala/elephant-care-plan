import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Fingerprint, ArrowRight, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { BiometricCapture } from "@/components/BiometricCapture";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function RegisterVisit() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [biometricsVerified, setBiometricsVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [receptionistBranchId, setReceptionistBranchId] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
    const [dependants, setDependants] = useState<any[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("");
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
            console.log("Fetching doctors for branch:", receptionistBranchId);
            const { data, error } = await supabase
                .rpc("get_branch_doctors", { branch_id_input: receptionistBranchId });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            console.log("Doctors fetched:", data);

            if (!data || data.length === 0) {
                toast({ title: "Info", description: "No doctors found for this branch." });
                setDoctors([]);
            } else {
                setDoctors(data);
            }
        } catch (error: any) {
            console.error("Error fetching doctors:", error);
            toast({
                title: "Error fetching doctors",
                description: error.message || "Unknown RPC error",
                variant: "destructive"
            });
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;

        setSearching(true);
        setMember(null);
        setDependants([]);
        setBiometricsVerified(false);

        try {
            // Use ilike with wildcards and double quotes for all fields to handle spaces and partial matches
            const { data, error } = await supabase
                .from("members")
                .select("*, membership_categories(name)")
                .or(`phone.ilike."%${term}%",id_number.ilike."%${term}%",member_number.ilike."%${term}%",full_name.ilike."%${term}%"`)
                .maybeSingle();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error("Multiple members found. Please enter a more specific ID, Phone, or Member Number.");
                }
                throw error;
            }

            if (data) {
                setMember(data);
                setSelectedPatientId(data.id); // Default to member

                // Fetch Dependants
                const { data: depsData, error: depsError } = await supabase
                    .from("dependants")
                    .select("*")
                    .eq("member_id", data.id);

                if (!depsError && depsData) {
                    setDependants(depsData);
                }

                if (data.biometric_data) {
                    setBiometricsVerified(false);
                } else {
                    setBiometricsVerified(true);
                    toast({ title: "No Biometric Data", description: "Member has no registered biometric data. Proceeding without biometric verification.", variant: "default" });
                }
            } else {
                toast({ title: "Member not found", description: "No member found matching that criteria.", variant: "destructive" });
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
            toast({ title: "Biometrics required", description: "Please verify identity first.", variant: "destructive" });
            return;
        }
        if (!member.is_active) {
            toast({ title: "Inactive Member", description: "Member is inactive. Advise payment before service. Principal member must be active.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const isDependant = selectedPatientId !== member.id;
            const payload: any = {
                member_id: member.id,
                branch_id: receptionistBranchId,
                receptionist_id: receptionistId,
                status: 'registered',
                doctor_id: selectedDoctorId || null,
                biometrics_verified: biometricsVerified,
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0
            };

            if (isDependant) {
                payload.dependant_id = selectedPatientId;
            }

            const { error } = await supabase.from('visits').insert([payload]);

            if (error) throw error;

            toast({ title: "Visit Registered", description: "Member is now in the queue for the doctor." });
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
                <Card className="border-primary/50">
                    <CardHeader className="bg-primary/5">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>{member.full_name}</CardTitle>
                                <CardDescription>Member #{member.member_number}</CardDescription>
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
                        </div>

                        {!member.is_active && (
                            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
                                <UserX className="h-5 w-5" />
                                <span className="font-medium">Member is inactive. Advise payment before service.</span>
                            </div>
                        )}

                        {member.is_active && (
                            <div className="space-y-4 pt-4 border-t">
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

                                <div className="space-y-4 pt-4 border-t">
                                    <Label className="text-base">Who is this visit for?</Label>
                                    <div className="grid gap-4">
                                        <div
                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedPatientId === member.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                            onClick={() => setSelectedPatientId(member.id)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-sm">Principal Member</p>
                                                    <p className="text-lg font-bold">{member.full_name}</p>
                                                </div>
                                                {selectedPatientId === member.id && <CheckCircle className="h-5 w-5 text-primary" />}
                                            </div>
                                        </div>

                                        {dependants.length > 0 && (
                                            <>
                                                <p className="text-sm font-medium text-muted-foreground mt-2">Dependants</p>
                                                {dependants.map((dep) => (
                                                    <div
                                                        key={dep.id}
                                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedPatientId === dep.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                                        onClick={() => setSelectedPatientId(dep.id)}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <p className="font-semibold text-sm capitalize">{dep.relationship}</p>
                                                                <p className="text-lg font-bold">{dep.full_name}</p>
                                                            </div>
                                                            {selectedPatientId === dep.id && <CheckCircle className="h-5 w-5 text-primary" />}
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>

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
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}