import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Plus } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

            toast({
                title: "Member Registered",
                description: `Successfully registered ${formData.fullName}. They can now log in.`
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
                <p className="text-muted-foreground">Register new members into the system</p>
            </div>
            <div className="card-elevated p-6">
                <form onSubmit={handleRegisterMember} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone *</Label>
                            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>ID Number *</Label>
                            <Input value={formData.idNumber} onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Age *</Label>
                            <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Temporary Password *</Label>
                            <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
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