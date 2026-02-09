import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Wallet, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function FinanceDashboard() {
    const [stats, setStats] = useState({
        approvedMarketer: 0,
        approvedBranch: 0,
        totalPaidThisMonth: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const [mClaims, bClaims] = await Promise.all([
                (supabase as any).from("marketer_claims").select("amount, status"),
                (supabase as any).from("revenue_claims").select("amount, status")
            ]);

            const approvedM = mClaims.data?.filter((c: any) => c.status === 'approved').reduce((s: number, c: any) => s + c.amount, 0) || 0;
            const approvedB = bClaims.data?.filter((c: any) => c.status === 'approved').reduce((s: number, c: any) => s + c.amount, 0) || 0;
            
            const paidM = mClaims.data?.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + c.amount, 0) || 0;
            const paidB = bClaims.data?.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + c.amount, 0) || 0;

            setStats({
                approvedMarketer: approvedM,
                approvedBranch: approvedB,
                totalPaidThisMonth: paidM + paidB
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Finance Overview</h1>
            
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-blue-600">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Approved Marketer Payouts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {stats.approvedMarketer.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting disbursement</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-600">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Approved Branch Payouts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {stats.approvedBranch.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting disbursement</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-600">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid (Lifetime)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {stats.totalPaidThisMonth.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Successfully processed</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}