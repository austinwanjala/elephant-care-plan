import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, Save, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface MembershipCategory {
    id: string;
    name: string;
    level: string;
    marketer_commission: number;
}

interface DefaultConfig {
    id: string;
    commission_per_referral: number;
    super_agent_cut_percent: number;
}

export default function AdminCommissionSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<MembershipCategory[]>([]);
    const [defaultConfig, setDefaultConfig] = useState<DefaultConfig | null>(null);

    // Form states
    const [categoryRates, setCategoryRates] = useState<Record<string, string>>({});
    const [defaultRate, setDefaultRate] = useState<string>("0");
    const [superAgentCut, setSuperAgentCut] = useState<string>("10");

    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Categories
            const { data: categoryData, error: categoryError } = await supabase
                .from("membership_categories")
                .select("id, name, level, marketer_commission")
                .order("level", { ascending: true });

            if (categoryError) throw categoryError;

            // Load Default Config
            const { data: configData, error: configError } = await (supabase as any)
                .from("marketer_commission_config")
                .select("*")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (configError) throw configError;

            setCategories(categoryData || []);
            setDefaultConfig(configData);
            
            // Initialize Form State
            const rates: Record<string, string> = {};
            categoryData?.forEach(cat => {
                rates[cat.id] = (cat.marketer_commission || 0).toString();
            });
            setCategoryRates(rates);

            if (configData) {
                setDefaultRate(configData.commission_per_referral.toString());
                setSuperAgentCut((configData.super_agent_cut_percent ?? 10).toString());
            }

        } catch (error: any) {
            toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleRateChange = (id: string, value: string) => {
        setCategoryRates(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated.");
            const { data: adminStaff } = await supabase.from("staff").select("id").eq("user_id", user.id).single();

            // 1. Update Membership Categories
            for (const category of categories) {
                const parsedRate = parseFloat(categoryRates[category.id] || "0");
                if (isNaN(parsedRate) || parsedRate < 0) {
                    throw new Error(`Invalid amount for ${category.name}`);
                }

                if (parsedRate !== (category.marketer_commission || 0)) {
                    const { error } = await supabase
                        .from("membership_categories")
                        .update({ marketer_commission: parsedRate })
                        .eq("id", category.id);
                    if (error) throw error;
                }
            }

            // 2. Update Default Config & Super Agent Cut
            const parsedDefault = parseFloat(defaultRate);
            const parsedCut = parseFloat(superAgentCut);
            if (isNaN(parsedDefault) || parsedDefault < 0) {
                throw new Error("Invalid default amount");
            }
            if (isNaN(parsedCut) || parsedCut < 0 || parsedCut > 100) {
                throw new Error("Invalid super agent cut (must be 0-100)");
            }

            if (defaultConfig?.id) {
                await (supabase as any)
                    .from("marketer_commission_config")
                    .update({
                        commission_per_referral: parsedDefault,
                        super_agent_cut_percent: parsedCut,
                        updated_at: new Date().toISOString(),
                        updated_by: adminStaff?.id
                    })
                    .eq("id", defaultConfig.id);
            } else {
                await (supabase as any)
                    .from("marketer_commission_config")
                    .insert({
                        commission_per_referral: parsedDefault,
                        super_agent_cut_percent: parsedCut,
                        updated_by: adminStaff?.id
                    });
            }

            toast({ title: "Settings Saved", description: "Commission rates for scheme levels updated successfully." });
            await loadData();
        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/admin/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Marketer Commission Settings</h1>
                    <p className="text-muted-foreground">Configure commission rates based on membership scheme levels.</p>
                </div>
            </div>

            <Card className="max-w-4xl shadow-md border-slate-200">
                <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl">
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                        Scheme-Level Tiered Rates
                    </CardTitle>
                    <CardDescription>
                        Set the specific amount marketers earn when they refer members into each scheme level.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.map((category) => (
                            <div key={category.id} className="space-y-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <Label className="text-base font-bold text-slate-800">{category.name}</Label>
                                    <p className="text-xs text-slate-500 capitalize">{category.level.replace('_', ' ')}</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-500 sm:text-sm">KES</span>
                                        </div>
                                        <Input
                                            type="number"
                                            value={categoryRates[category.id] || ""}
                                            onChange={(e) => handleRateChange(category.id, e.target.value)}
                                            className="pl-12 font-semibold"
                                            min="0"
                                            step="50"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <hr className="my-6 border-slate-100" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                             <h4 className="font-semibold text-slate-800 mb-2">Fallback Default Rate</h4>
                             <p className="text-sm text-slate-500 mb-4">
                                 Applied if a scheme does not have a defined commission amount (Set to 0).
                             </p>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-500 sm:text-sm">KES</span>
                                </div>
                                <Input
                                    type="number"
                                    value={defaultRate}
                                    onChange={(e) => setDefaultRate(e.target.value)}
                                    className="pl-12 font-semibold"
                                    min="0"
                                    step="50"
                                />
                            </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                             <h4 className="font-semibold text-indigo-900 mb-2">Super Agent Cut</h4>
                             <p className="text-sm text-indigo-700/80 mb-4">
                                 Percentage of total marketer commissions automatically diverted to the active Super Agent.
                             </p>
                            <div className="relative">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                    <span className="text-indigo-500 font-bold">%</span>
                                </div>
                                <Input
                                    type="number"
                                    value={superAgentCut}
                                    onChange={(e) => setSuperAgentCut(e.target.value)}
                                    className="pr-12 font-semibold border-indigo-200 focus-visible:ring-indigo-500"
                                    min="0"
                                    max="100"
                                    step="1"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                        <h4 className="font-semibold text-blue-900 mb-2">How Commissions Work</h4>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                            <li>Marketers earn commission dynamically based on the specific scheme level an active referred member is enrolled in.</li>
                            <li>Commission is verified and applied when the member becomes active.</li>
                            <li>Marketers cannot claim cash until the administration approves their commissions.</li>
                        </ul>
                    </div>

                    <div className="pt-4">
                        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold">
                            {saving ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Saving Rates...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Save Commission Rates
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
