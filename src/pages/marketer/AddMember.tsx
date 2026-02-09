import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";

export default function MarketerAddMember() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [marketerInfo, setMarketerInfo] = useState<{ id: string, code: string } | null>(null);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        idNumber: "",
        age: "",
        password: "",
    });

    useEffect(() => {
        fetchMarketerInfo();
    }, []);

    const fetchMarketerInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: mData } = await supabase
            .from("marketers")
            .select("id, code")
            .eq("user_id", user.id)
            .maybeSingle();

        if (mData) setMarketerInfo(mData);
    };

    const handleRegisterMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!marketerInfo) {
            toast({ title: "Error", description: "Marketer profile not found.", variant: "destructive" });
            return;
        }

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
                        marketer_id: marketerInfo.id,
                        marketer_code: marketerInfo.code
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
                description: `Successfully registered ${formData.fullName}. They are now linked to your account.`
            });

            setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "" });
            navigate("/marketer/referrals");
        } catch (error: any) {
            toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketer">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Register New Member</h1>
                    <p className="text-muted-foreground">Add a new member directly. They will be automatically linked to your referrals.</p>
                </div>
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
                            <Label>Set Password *</Label>
                            <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} placeholder="Enter password" />
                        </div>
                    </div>
                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-4" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Register Member
                    </Button>
                </form>
            </div>
        </div>
    );
}