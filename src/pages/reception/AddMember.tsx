import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

    const handleRegisterMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const ageInt = parseInt(formData.age);
            if (isNaN(ageInt)) throw new Error("Please enter a valid age.");

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
                    }
                }
            });

            if (authError) throw authError;

            // Send Welcome SMS
            try {
                await supabase.functions.invoke('send-sms', {
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
                description: `Successfully registered ${formData.fullName}. They can now log in to add dependants.`
            });

            setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "" });
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
                <p className="text-muted-foreground">Register new members. Dependants must be added by the member via their portal.</p>
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

                    <Button type="submit" className="w-full btn-primary mt-4" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Register Member
                    </Button>
                </form>
            </div>
        </div>
    );
}