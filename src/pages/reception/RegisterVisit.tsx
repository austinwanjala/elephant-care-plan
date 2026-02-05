import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Fingerprint, ArrowRight, Loader2, CheckCircle, ArrowLeft, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { BiometricCapture } from "@/components/BiometricCapture";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Dependant {
    id: string;
    full_name: string;
    relationship: string;
}

interface Service {
    id: string;
    name: string;
}

export default function RegisterVisit() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [member, setMember] = useState<any>(null);
    const [dependants, setDependants] = useState<Dependant[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("self"); // 'self' or dependant_id
    const [biometricsVerified, setBiometricsVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [receptionistBranchId, setReceptionistBranchId] = useState<string | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string>("");
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchReceptionistInfo();
        fetchServices();
    }, []);

    const fetchServices = async () => {
        const { data, error } = await supabase
            .from("services")
            .select("id, name")
            .eq("is_active", true)
            .order("name");

        if (data) {
            setServices(data);
            if (data.length > 0) {
                // Optional: Default to first service or specific one if needed
            }
        }
    };

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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm) return;
        setSearching(true);
        setMember(null);
        setSearchResults([]);
        setDependants([]);
        setBiometricsVerified(false);
        setSelectedPatientId("self");

        try {
            // First try exact match on phone or ID
            let { data, error } = await supabase
                .from("members")
                .select("*, membership_categories(name)")
                .or(`phone.eq.${searchTerm},id_number.eq.${searchTerm}`);

            if (error) throw error;

            // If no exact match, try partial match on name
            if (!data || data.length === 0) {
                const { data: nameData, error: nameError } = await supabase
                    .from("members")
                    .select("*, membership_categories(name)")
                    .ilike('full_name', `%${searchTerm}%`)
                    .limit(5);

                if (nameError) throw nameError;
                data = nameData;
            }

            if (data && data.length > 0) {
                if (data.length === 1) {
                    selectMember(data[0]);
                } else {
                    setSearchResults(data);
                }
            } else {
                toast({ title: "Member not found", description: "No member found with that details.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Search failed", description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const selectMember = async (selectedMember: any) => {
        setMember(selectedMember);
        setSearchResults([]);

        // Fetch dependants
        const { data: deps, error: depsError } = await supabase
            .from("dependants")
            .select("id, full_name, relationship")
            .eq("member_id", selectedMember.id);

        if (!depsError && deps) {
            setDependants(deps);
        }

        // Check biometrics
        if (selectedMember.biometric_data) {
            setBiometricsVerified(false);
        } else {
            setBiometricsVerified(true);
            toast({ title: "No Biometric Data", description: "Proceeding without verification.", variant: "default" });
        }
    };

    const handleBiometricVerificationComplete = (success: boolean) => {
        setBiometricsVerified(success);
        if (!success) {
            toast({ title: "Verification Failed", description: "Please try again.", variant: "destructive" });
        }
    };

    const handleRegisterVisit = async () => {
        if (!member || !receptionistId || !receptionistBranchId) return;
        if (!biometricsVerified) {
            toast({ title: "Biometrics required", description: "Please verify identity first.", variant: "destructive" });
            return;
        }
        if (!member.is_active) {
            toast({ title: "Inactive Member", description: "Member is inactive.", variant: "destructive" });
            return;
        }
        if (!selectedServiceId) {
            toast({ title: "Service Required", description: "Please select a service for this visit.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const isDependant = selectedPatientId !== "self";
            const dependantId = isDependant ? selectedPatientId : null;

            const { error } = await supabase.from('visits').insert({
                member_id: member.id,
                dependant_id: dependantId,
                branch_id: receptionistBranchId,
                receptionist_id: receptionistId,
                status: 'registered',
                biometrics_verified: biometricsVerified,
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0,
                service_id: selectedServiceId
            });

            if (error) throw error;

            toast({ title: "Visit Registered", description: "Patient is now in the queue." });
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
                    <CardDescription>Search by Name, Phone, or ID Number.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <Input
                            placeholder="Enter Name, Phone, or ID..."
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

            {/* Search Results List */}
            {searchResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Select Member</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {searchResults.map((res) => (
                            <div key={res.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => selectMember(res)}
                            >
                                <div>
                                    <p className="font-semibold">{res.full_name}</p>
                                    <p className="text-sm text-muted-foreground">{res.phone} | {res.id_number}</p>
                                </div>
                                <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

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
                            <div><Label className="text-muted-foreground">Phone</Label><p className="font-medium">{member.phone}</p></div>
                            <div><Label className="text-muted-foreground">ID Number</Label><p className="font-medium">{member.id_number}</p></div>
                            <div><Label className="text-muted-foreground">Coverage Balance</Label><p className="font-medium text-primary">KES {member.coverage_balance?.toLocaleString()}</p></div>
                            <div><Label className="text-muted-foreground">Membership</Label><p className="font-medium">{member.membership_categories?.name || "N/A"}</p></div>
                        </div>

                        {/* Patient Selection */}
                        <div className="space-y-3 pt-4 border-t">
                            <Label className="text-base font-semibold">Select Patient</Label>
                            <RadioGroup value={selectedPatientId} onValueChange={setSelectedPatientId} className="grid gap-3">
                                <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50">
                                    <RadioGroupItem value="self" id="self" />
                                    <Label htmlFor="self" className="flex items-center gap-2 cursor-pointer w-full">
                                        <User className="h-4 w-4 text-primary" />
                                        <span>{member.full_name} <Badge variant="outline" className="ml-2">Primary Member</Badge></span>
                                    </Label>
                                </div>
                                {dependants.map(dep => (
                                    <div key={dep.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50">
                                        <RadioGroupItem value={dep.id} id={dep.id} />
                                        <Label htmlFor={dep.id} className="flex items-center gap-2 cursor-pointer w-full">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <span>{dep.full_name} <span className="text-muted-foreground text-sm">({dep.relationship})</span></span>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* Service Selection */}
                        <div className="space-y-3 pt-4 border-t">
                            <Label className="text-base font-semibold">Select Service</Label>
                            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select purpose of visit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {services.map((service) => (
                                        <SelectItem key={service.id} value={service.id}>
                                            {service.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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
                                            <p className="font-medium">No Biometric Data</p>
                                            <p className="text-xs">Proceeding without biometric verification.</p>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    className="w-full btn-primary"
                                    size="lg"
                                    disabled={!biometricsVerified || loading || !receptionistId || !receptionistBranchId}
                                    onClick={handleRegisterVisit}
                                >
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <UserCheck className="mr-2 h-5 w-5" />}
                                    Register Visit for {selectedPatientId === 'self' ? member.full_name : dependants.find(d => d.id === selectedPatientId)?.full_name}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}