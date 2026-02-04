import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, Save, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface CommissionConfig {
    id: string;
    commission_per_referral: number;
    updated_at: string;
}

export default function AdminCommissionSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<CommissionConfig | null>(null);
    const [commissionRate, setCommissionRate] = useState<string>("");
    const { toast } = useToast();

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        // Using 'as any' for custom tables not yet in types
        const { data, error } = await (supabase as any)
            .from("marketer_commission_config")
            .select("*")
            .maybeSingle();

        if (error) {
            toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        } else if (data) {
            setConfig(data);
            setCommissionRate(data.commission_per_referral.toString());
        } else {
            // Default if no config exists
            setCommissionRate("0");
        }
        setLoading(false);
    };

    const handleSave = async () => {
        const rate = parseFloat(commissionRate);
        if (isNaN(rate) || rate < 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid commission rate.", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated.");

            const { data: adminStaff } = await supabase.from("staff").select("id").eq("user_id", user.id).single();

            let error;
            if (config?.id) {
                const { error: updateError } = await (supabase as any)
                    .from("marketer_commission_config")
                    .update({
                        commission_per_referral: rate,
                        updated_at: new Date().toISOString(),
                        updated_by: adminStaff?.id
                    })
                    .eq("id", config.id);
                error = updateError;
            } else {
                const { error: insertError } = await (supabase as any)
                    .from("marketer_commission_config")
                    .insert({
                        commission_per_referral: rate,
                        updated_by: adminStaff?.id
                    });
                error = insertError;
            }

            if (error) throw error;

            toast({ title: "Settings Saved", description: `Commission rate updated to KES ${rate.toLocaleString()} per referral.` });
            loadConfig();
        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                    <Link to="/admin/settings">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-foreground">Marketer Commission Settings</h1>
                        <p className="text-muted-foreground">Configure commission rates for marketer referrals</p>
                    </div>
                </div>

                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-primary" />
                            Commission Rate Configuration
                        </CardTitle>
                        <CardDescription>
                            Set the commission amount paid to marketers for each active referral.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="commissionRate">Commission Per Active Referral (KES)</Label>
                            <Input
                                id="commissionRate"
                                type="number"
                                value={commissionRate}
                                onChange={(e) => setCommissionRate(e.target.value)}
                                placeholder="e.g., 500"
                                min="0"
                                step="1"
                            />
                            <p className="text-sm text-muted-foreground">
                                Marketers will earn this amount for each member they refer who has an active membership.
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-900 mb-2">How It Works</h4>
                            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                                <li>Marketers earn commission for each <strong>active</strong> member they refer</li>
                                <li>Commission is calculated as: Active Referrals × Rate</li>
                                <li>Marketers can submit claims which require admin approval</li>
                                <li>Once paid, the amount is deducted from their claimable balance</li>
                            </ul>
                        </div>

                        {config && (
                            <div className="text-sm text-muted-foreground">
                                Last updated: {new Date(config.updated_at).toLocaleString()}
                            </div>
                        )}

                        <Button onClick={handleSave} disabled={saving} className="btn-primary">
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}