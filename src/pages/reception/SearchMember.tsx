import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, User, Phone, Mail, CreditCard, CalendarDays, ArrowLeft, Loader2, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BiometricCapture } from "@/components/BiometricCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ReceptionSearchMember() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [biometricDialogOpen, setBiometricDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;

        setSearching(true);
        setMember(null);

        try {
            // 1. Search Principals
            const { data: principalMatches, error: principalError } = await supabase
                .from("members")
                .select("*, membership_categories(name), branches(name), dependants(*)")
                .or(`phone.ilike."%${term}%",id_number.ilike."%${term}%",member_number.ilike."%${term}%",full_name.ilike."%${term}%"`);

            if (principalError) throw principalError;

            // 2. Search Dependants
            const { data: dependantMatches, error: dependantError } = await supabase
                .from("dependants")
                .select("member_id")
                .or(`full_name.ilike."%${term}%",id_number.ilike."%${term}%"`);

            if (dependantError) throw dependantError;

            let allResults = [...(principalMatches || [])];

            // Collect unique member IDs from dependants that weren't found in principal search
            const foundIds = new Set(allResults.map(m => m.id));
            const missingIds = (dependantMatches || [])
                .map(d => d.member_id)
                .filter(id => !foundIds.has(id));

            if (missingIds.length > 0) {
                const { data: extraMembers, error: extraError } = await supabase
                    .from("members")
                    .select("*, membership_categories(name), branches(name), dependants(*)")
                    .in("id", missingIds);

                if (!extraError && extraMembers) {
                    allResults = [...allResults, ...extraMembers];
                }
            }

            if (allResults.length > 0) {
                // If multiple results, just take the first one or throw error similar to previous behavior
                // The RegisterVisit page handles multiple results better with a dialog, 
                // but here we follow the original logic of maybeSingle/Single
                if (allResults.length > 1) {
                    toast({ title: "Note", description: "Multiple members found. Showing the closest match." });
                }
                setMember(allResults[0]);
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/reception">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Search Member</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Member Lookup</CardTitle>
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
                            <div className="flex gap-2">
                                {!member.biometric_data ? (
                                    <Button variant="outline" size="sm" onClick={() => setBiometricDialogOpen(true)}>
                                        <Fingerprint className="mr-2 h-4 w-4" /> Capture Biometrics
                                    </Button>
                                ) : (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                        <Fingerprint className="mr-1 h-3 w-3" /> Biometrics Registered
                                    </Badge>
                                )}
                                <Badge variant={member.is_active ? "default" : "destructive"}>
                                    {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <Label className="text-muted-foreground">Phone</Label>
                                <p className="font-medium flex items-center gap-1"><Phone className="h-4 w-4" /> {member.phone}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">ID Number</Label>
                                <p className="font-medium flex items-center gap-1"><CreditCard className="h-4 w-4" /> {member.id_number}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Email</Label>
                                <p className="font-medium flex items-center gap-1"><Mail className="h-4 w-4" /> {member.email}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Age</Label>
                                <p className="font-medium flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {member.age || "N/A"}</p>
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
                    </CardContent>
                </Card>
            )}

            {member && member.dependants && member.dependants.length > 0 && (
                <Card className="border-primary/50">
                    <CardHeader className="bg-primary/5">
                        <CardTitle className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /> Registered Dependants</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {member.dependants.map((dep: any) => (
                                <div key={dep.id} className="flex flex-col items-center p-4 border rounded-lg bg-card shadow-sm">
                                    <div className="mb-4 relative h-[180px] w-[150px] bg-muted rounded-md overflow-hidden border">
                                        {dep.image_url ? (
                                            <img
                                                src={dep.image_url}
                                                alt={dep.full_name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center bg-muted">
                                                <User className="h-12 w-12 text-muted-foreground/30" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center w-full">
                                        <p className="font-semibold truncate" title={dep.full_name}>{dep.full_name}</p>
                                        <Badge variant="outline" className="mt-1 mb-2">{dep.relationship}</Badge>
                                        <div className="text-xs text-muted-foreground grid gap-1 text-left w-full pl-2">
                                            <p>DOB: {new Date(dep.dob).toLocaleDateString()}</p>
                                            <p>ID: {dep.id_number}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={biometricDialogOpen} onOpenChange={setBiometricDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Capture Member Biometrics</DialogTitle>
                    </DialogHeader>
                    {member && (
                        <BiometricCapture
                            mode="register"
                            userId={member.id}
                            userName={member.full_name}
                            onCaptureComplete={async (data) => {
                                await supabase.from("members").update({ biometric_data: data }).eq("id", member.id);
                                setBiometricDialogOpen(false);
                                toast({ title: "Biometrics Updated", description: "Member biometrics captured successfully." });
                                // Refresh member data?
                                setMember({ ...member, biometric_data: data });
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}