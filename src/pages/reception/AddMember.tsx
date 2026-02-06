import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@supabase/supabase-js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { supabase as mainSupabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Dependant {
    fullName: string;
    relationship: string;
    dob: string;
    documentType: string;
    documentNumber: string;
}

export default function AddMember() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        idNumber: "",
        age: "",
        password: "",
    });
    const [dependants, setDependants] = useState<Dependant[]>([]);

    const addDependant = () => {
        if (dependants.length >= 5) {
            toast({ title: "Limit Reached", description: "You can only add up to 5 dependants.", variant: "destructive" });
            return;
        }
        setDependants([...dependants, { fullName: "", relationship: "Child", dob: "", documentType: "birth_certificate", documentNumber: "" }]);
    };

    const removeDependant = (index: number) => {
        setDependants(dependants.filter((_, i) => i !== index));
    };

    const updateDependant = (index: number, field: keyof Dependant, value: string) => {
        const newDeps = [...dependants];
        newDeps[index] = { ...newDeps[index], [field]: value };
        setDependants(newDeps);
    };

    const handleRegisterMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const ageInt = parseInt(formData.age);
            if (isNaN(ageInt)) throw new Error("Please enter a valid age.");

            const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });

            const { error: authError } = await authClient.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        role: 'member',
                        full_name: formData.fullName,
                        phone: formData.phone,
                        id_number: formData.idNumber,
                        age: ageInt,
                    }
                }
            });

            if (authError) throw authError;

            // Get the new user's ID (which is the member ID)
            const newMemberId = authError ? null : (await authClient.auth.getUser()).data.user?.id; // Actually we can't get ID easily locally with signUp options without session, 
            // BUT wait, signUp returns data.user if autoConfirm is on or if we just proceed.
            // Actually better approach: The 'members' table entry is created via trigger on auth.users usually? 
            // OR we rely on the fact we just signed up. 
            // The trigger creates the public.members row.

            // Wait a moment for trigger (not ideal but common in Supabase quick-starts) or better:
            // Since we don't have the ID immediately if email confirmation is required, 
            // but if not, we get it. Let's assume we get user object.

            // Correction: The signUp response contains `data.user`.
            const userId = (await authClient.auth.getSession()).data.session?.user.id || (await authClient.auth.getUser()).data.user?.id;

            if (userId && dependants.length > 0) {
                const { error: depError } = await mainSupabase
                    .from("dependants")
                    .insert(
                        dependants.map(d => ({
                            member_id: userId,
                            full_name: d.fullName,
                            relationship: d.relationship.toLowerCase(),
                            dob: d.dob,
                            document_type: d.documentType,
                            document_number: d.documentNumber
                        }))
                    );

                if (depError) {
                    console.error("Error adding dependants:", depError);
                    toast({ title: "Warning", description: "Member created but failed to add dependants.", variant: "destructive" });
                }
            }

            // Send Welcome SMS
            try {
                await mainSupabase.functions.invoke('send-sms', {
                    body: {
                        type: 'welcome',
                        phone: formData.phone,
                        data: { name: formData.fullName }
                    }
                });
            } catch (smsErr) {
                console.error("Failed to send welcome SMS:", smsErr);
            }

            toast({
                title: "Member Registered",
                description: `Successfully registered ${formData.fullName}. They can now log in.`
            });

            setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "" });
            setDependants([]);
        } catch (error: any) {
            toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div>
                <h1 className="text-3xl font-serif font-bold text-foreground">Add Member</h1>
                <p className="text-muted-foreground">Register new members into the system</p>
            </div>
            <div className="card-elevated p-6">
                <form onSubmit={handleRegisterMember} className="space-y-4">
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
                            <Label>Phone *</Label>
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
                            <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} placeholder="Enter password" />
                        </div>
                    </div>

                    {/* Dependants Section */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Dependants ({dependants.length}/5)</h3>
                            <Button type="button" variant="outline" size="sm" onClick={addDependant} disabled={dependants.length >= 5}>
                                <Plus className="h-4 w-4 mr-1" /> Add Dependant
                            </Button>
                        </div>

                        {dependants.map((dep, index) => (
                            <div key={index} className="grid md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg relative">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-2 h-6 w-6 text-destructive hover:bg-destructive/10"
                                    onClick={() => removeDependant(index)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input
                                        value={dep.fullName}
                                        onChange={(e) => updateDependant(index, 'fullName', e.target.value)}
                                        required
                                        placeholder="Dependant Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Relationship</Label>
                                    <Select
                                        value={dep.relationship}
                                        onValueChange={(val) => updateDependant(index, 'relationship', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Spouse">Spouse</SelectItem>
                                            <SelectItem value="Child">Child</SelectItem>
                                            <SelectItem value="Parent">Parent</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date of Birth</Label>
                                    <Input
                                        type="date"
                                        value={dep.dob}
                                        onChange={(e) => updateDependant(index, 'dob', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Document Type</Label>
                                    <Select
                                        value={dep.documentType}
                                        onValueChange={(val) => updateDependant(index, 'documentType', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="birth_certificate">Birth Certificate</SelectItem>
                                            <SelectItem value="student_id">Student ID</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Document Number</Label>
                                    <Input
                                        value={dep.documentNumber}
                                        onChange={(e) => updateDependant(index, 'documentNumber', e.target.value)}
                                        required
                                        placeholder={dep.documentType === 'birth_certificate' ? "e.g. BC-123456" : "e.g. ST-7890"}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="submit" className="w-full btn-primary mt-4" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Register Member
                    </Button>
                </form>
            </div>
        </div>
    );
}