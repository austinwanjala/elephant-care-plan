import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DollarSign, Users, TrendingUp, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SuperAgentDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalMarketers: 0,
        totalCommissions: 0,
        pendingCommissions: 0,
        recentReferrals: 0,
    });
    const { toast } = useToast();

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Marketers Count
            // Note: If super agent is in charge of ALL marketers:
            const { count: marketersCount } = await supabase
                .from("user_roles")
                .select("*", { count: 'exact', head: true })
                .eq("role", "marketer");

            // Super agent commissions stat
            const { data: commissions } = await supabase
                .from("super_agent_commissions" as any)
                .select("amount, status")
                .eq("super_agent_id", user.id);

            let totalComm = 0;
            let pendingComm = 0;
            let recentRef = 0;

            if (commissions) {
                totalComm = commissions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
                pendingComm = commissions.filter(c => c.status === 'unclaimed').reduce((acc, curr) => acc + (curr.amount || 0), 0);
                recentRef = commissions.length;
            }

            setStats({
                totalMarketers: marketersCount || 0,
                totalCommissions: totalComm,
                pendingCommissions: pendingComm,
                recentReferrals: recentRef
            });
        } catch (error: any) {
            toast({ title: "Error loading statistics", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">Overview</h1>
                    <p className="text-slate-500">Track aggregate performance and passive earnings.</p>
                </div>
                <button 
                    onClick={loadStats}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw className="h-4 w-4" /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none shadow-md overflow-hidden bg-white/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-indigo-50 to-white">
                        <CardTitle className="text-sm font-medium text-indigo-800">Total Commissions Earned</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-indigo-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-black text-slate-800">KES {stats.totalCommissions.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Lifetime aggregate earnings</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md overflow-hidden bg-white/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-emerald-50 to-white">
                        <CardTitle className="text-sm font-medium text-emerald-800">Unclaimed Balance</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-black text-slate-800">KES {stats.pendingCommissions.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Available to claim</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md overflow-hidden bg-white/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-blue-50 to-white">
                        <CardTitle className="text-sm font-medium text-blue-800">Total Marketers</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-black text-slate-800">{stats.totalMarketers.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Active field agents</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md overflow-hidden bg-white/60 backdrop-blur-sm justify-center">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-amber-50 to-white">
                        <CardTitle className="text-sm font-medium text-amber-800">Total Successful Referrals</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-amber-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-black text-slate-800">{stats.recentReferrals.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Generated by marketers</p>
                    </CardContent>
                </Card>
            </div>
            
            <div className="mt-8">
                <h3 className="text-xl font-bold text-slate-800 mb-4">How it works</h3>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-indigo-900 shadow-sm">
                    <p className="mb-2 font-medium">As a Super Agent, you oversee the field marketers and receive a percentage cut of all generated referrals automatically.</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-indigo-800/80 mt-4">
                        <li>The administration dynamically sets your percentage cut based on operations.</li>
                        <li>Whenever a marketer successfully converts an active member, their total possible commission is calculated via the member's scheme.</li>
                        <li>Your passive cut is instantly deducted and credited to your portal, and the remaining amount goes to the marketer.</li>
                        <li>Navigate to exactly how much you can claim using the <strong className="text-indigo-900">Commissions</strong> tab on the left.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
