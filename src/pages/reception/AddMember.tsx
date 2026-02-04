import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Plus } from "lucide-react";

// Initialize a separate client for auth to avoid session switching
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
            if (!formData.email || !formData.password || !formData.fullName || !formData.phone || !formData.idNumber || !formData.age) {
                toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
                setLoading(false);
                return;
            }

            // 1. Create the Auth account using a "no-session" client
            // We pass all data into metadata so the DB trigger can handle profile creation
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
                        age: parseInt(formData.age),
                    }
                }
            });

            if (authError) {
                if (authError.message.toLowerCase().includes("already registered")) {
                    throw new Error("This email is already registered.");
                }
                throw authError;
            }

            toast({
                title: "Member Registered",
                description: `Successfully registered ${formData.fullName}. The system is setting up their profile...`
            });

            // Reset form
            setFormData({
                fullName: "",
                email: "",
                phone: "",
                idNumber: "",
                age: "",
                password: "",
            });

        } catch (error: any) {
            console.error("Registration error:", error);
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
                            <Input
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                placeholder="John Doe"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone *</Label>
                            <Input
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="0712345678"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ID Number *</Label>
                            <Input
                                value={formData.idNumber}
                                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                                placeholder="12345678"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Age *</Label>
                            <Input
                                type="number"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                placeholder="30"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Temporary Password *</Label>
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="To be changed by member"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="submit" className="w-full btn-primary" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Register Member
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}