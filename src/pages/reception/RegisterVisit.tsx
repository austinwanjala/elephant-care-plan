import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCheck, UserX, Fingerprint, ArrowRight, Loader2, CheckCircle } from "lucide-react";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function RegisterVisit() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [biometricsVerified, setBiometricsVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm) return;
        setSearching(true);
        setMember(null);
        setBiometricsVerified(false);

        try {
            // Search by phone or ID
            // @ts-ignore
            const { data, error } = await supabase
                .from("members")
                .select("*, membership_categories(name)")
                .or(`phone.eq.${searchTerm},id_number.eq.${searchTerm}`)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setMember(data);
            } else {
                toast({ title: "Member not found", description: "No member found with that Phone or ID.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Search failed", description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const handleBiometricAuth = async () => {
        // Mock biometric authentication
        setLoading(true);
        setTimeout(() => {
            setBiometricsVerified(true);
            setLoading(false);
            toast({ title: "Biometrics Verified", description: "Identity confirmed successfully.", className: "bg-green-500 text-white" });
        }, 1500);
    };

    const handleRegisterVisit = async () => {
        if (!member) return;
        if (!biometricsVerified) {
            toast({ title: "Biometrics required", description: "Please verify identity first.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            // Get current user (receptionist)
            const { data: { user } } = await supabase.auth.getUser();

            // Get a default branch (for now, pick the first active branch or user's branch logic if implemented)
            // In real app, receptionist belongs to a branch. For now we fetch one.
            // @ts-ignore
            const { data: branch } = await supabase.from('branches').select('id').limit(1).single();

            if (!branch) throw new Error("No active branch found system-wide.");

            // Create Visit
            // @ts-ignore
            const { error } = await supabase.from('visits').insert({
                member_id: member.id,
                branch_id: branch.id,
                receptionist_id: user?.id,
                status: 'registered',
                biometrics_verified: true
            });

            if (error) throw error;

            toast({ title: "Visit Registered", description: "Member is now in the queue for the doctor." });
            navigate("/reception"); // Back to dashboard
        } catch (error: any) {
            toast({ title: "Registration failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Register New Visit</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Member Search</CardTitle>
                    <CardDescription>Enter Phone Number or National ID to find the member.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <Input
                            placeholder="Phone or ID Number"
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
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-full ${biometricsVerified ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <Fingerprint className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Biometric Verification</p>
                                            <p className="text-xs text-muted-foreground">Required to proceed</p>
                                        </div>
                                    </div>
                                    {!biometricsVerified ? (
                                        <Button onClick={handleBiometricAuth} disabled={loading}>
                                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Verify Identity"}
                                        </Button>
                                    ) : (
                                        <Badge className="bg-green-500 hover:bg-green-600">
                                            <CheckCircle className="h-3 w-3 mr-1" /> Verified
                                        </Badge>
                                    )}
                                </div>

                                <Button
                                    className="w-full btn-primary"
                                    size="lg"
                                    disabled={!biometricsVerified || loading}
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
