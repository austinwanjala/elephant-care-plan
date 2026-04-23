import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, User, Phone, Mail, CreditCard, CalendarDays, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BiometricCapture } from "@/components/BiometricCapture";
import CardScanner from "@/components/medical-card/CardScanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

export default function ReceptionSearchMember() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [member, setMember] = useState<any>(null);
    const [enrollmentTarget, setEnrollmentTarget] = useState<{ id: string, name: string, table: 'members' | 'dependants' } | null>(null);
    const [biometricDialogOpen, setBiometricDialogOpen] = useState(false);
    const [scanDialogOpen, setScanDialogOpen] = useState(false);
    const { toast } = useToast();

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
            // 1. Search Principals
            const { data: principalMatches, error: principalError } = await supabase
                .from("members")
                .select("*, membership_categories(name), branches(name), dependants(*)")
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

            setSearchResults(allResults);
            if (allResults.length === 1 && query === searchTerm) {
                // If only one result and it's a full match, maybe auto-select?
                // For now, just let the list show.
            }
        } catch (error: any) {
            console.error("Search error:", error);
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
                    <div className="relative">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Type Name, Phone, ID, or Member #..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11 bg-slate-50 focus:bg-white transition-all shadow-inner"
                                />
                                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                            </div>
                            <Button type="submit" disabled={searching} className="h-11 px-6 shadow-md">
                                Search
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 gap-2 border-primary/30 text-primary"
                                onClick={() => setScanDialogOpen(true)}
                            >
                                <QrCode className="h-4 w-4" />
                                Scan
                            </Button>
                        </form>

                        {(searchResults.length > 0 || searching) && searchTerm.trim().length >= 1 && !member && (
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

                                    {searchResults.map((res: any) => (
                                        <div
                                            key={res.id}
                                            className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                                            onClick={() => {
                                                setMember(res);
                                                setSearchResults([]);
                                                setSearchTerm("");
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {(res.full_name || "M").charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 leading-none group-hover:text-primary transition-colors">{res.full_name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        #{res.member_number} • {res.phone} • {res.id_number}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!res.biometric_data && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="h-7 px-2 text-[10px] font-bold bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMember(res);
                                                            setEnrollmentTarget({ id: res.id, name: res.full_name, table: 'members' });
                                                            setBiometricDialogOpen(true);
                                                        }}
                                                    >
                                                        Enroll
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="ghost" className="text-xs group-hover:text-primary">Select</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                    <span>{searching ? "Searching..." : `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'} found`}</span>
                                    <button onClick={() => setSearchResults([])} className="hover:text-primary active:scale-95 transition-all text-primary uppercase font-bold text-[9px] tracking-wider">Clear</button>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Scan Insurance Card</DialogTitle>
                    </DialogHeader>
                    <CardScanner />
                </DialogContent>
            </Dialog>


            {member && (
                <Card className="border-primary/50">
                    <CardHeader className="bg-primary/5">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-4">
                                {member.biometric_data && (() => {
                                    try {
                                        const bios = typeof member.biometric_data === 'string' ? JSON.parse(member.biometric_data) : member.biometric_data;
                                        if (!bios?.face_template) return null;
                                        return (
                                            <div className="h-20 w-20 rounded-2xl bg-white border-2 border-primary/20 overflow-hidden shadow-sm flex-shrink-0">
                                                <img src={bios.face_template} alt="Member Face" className="h-full w-full object-cover" />
                                            </div>
                                        );
                                    } catch (e) { return null; }
                                })()}
                                <div>
                                    <CardTitle className="text-2xl">{member.full_name}</CardTitle>
                                    <CardDescription>Member Number: {member.member_number}</CardDescription>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Badge variant={member.is_active ? "default" : "destructive"}>
                                    {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {member.biometric_data ? (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                        <ShieldCheck className="h-3 w-3 mr-1" /> Biometric Identity Verified
                                    </Badge>
                                ) : (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:text-amber-700 h-8 text-[10px] font-black uppercase tracking-widest"
                                        onClick={() => {
                                            setEnrollmentTarget({ id: member.id, name: member.full_name, table: 'members' });
                                            setBiometricDialogOpen(true);
                                        }}
                                    >
                                        Enroll Face ID
                                    </Button>
                                )}
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
                                        {dep.biometric_data ? (
                                            <Badge variant="secondary" className="mt-3 w-full bg-blue-100 text-blue-700 border-blue-200 text-[9px] uppercase font-black">
                                                Verified
                                            </Badge>
                                        ) : (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="mt-3 w-full bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:text-amber-700 h-8 text-[9px] font-black uppercase tracking-widest"
                                                onClick={() => {
                                                    setEnrollmentTarget({ id: dep.id, name: dep.full_name, table: 'dependants' });
                                                    setBiometricDialogOpen(true);
                                                }}
                                            >
                                                Enroll Face ID
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={biometricDialogOpen} onOpenChange={(open) => {
                setBiometricDialogOpen(open);
                if (!open) setEnrollmentTarget(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Capture Face ID Profile</DialogTitle>
                    </DialogHeader>
                    {enrollmentTarget && (
                        <BiometricCapture
                            mode="register"
                            userId={enrollmentTarget.id}
                            userName={enrollmentTarget.name}
                            targetTable={enrollmentTarget.table}
                            onVerificationComplete={async () => {
                                // FaceBiometricCapture already records to DB.
                                // We just need to refresh the local member state.
                                if (member) {
                                    const { data: updatedMember } = await supabase
                                        .from("members")
                                        .select("*, membership_categories(name), branches(name), dependants(*)")
                                        .eq("id", member.id)
                                        .maybeSingle();
                                    
                                    if (updatedMember) {
                                        setMember(updatedMember);
                                    }
                                }
                                setBiometricDialogOpen(false);
                                setEnrollmentTarget(null);
                                toast({ title: "Profile Secured", description: "Biometric identity has been mapped successfully." });
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
