import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, TrendingUp, CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface MarketerInfo {
    id: string;
    total_earnings: number;
    code: string;
}

interface EarningsEntry {
    id: string;
    member_name: string;
    member_number: string;
    amount: number;
    earned_at: string;
    status: string; // e.g., 'pending', 'paid'
}

export default function MarketerEarnings() {
    const [loading, setLoading] = useState(true);
    const [marketer, setMarketer] = useState<MarketerInfo | null>(null);
    const [earningsHistory, setEarningsHistory] = useState<EarningsEntry[]>([]);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchMarketerData();
    }, []);

    const fetchMarketerData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: mData, error: mError } = await supabase
            .from("marketers")
            .select("id, total_earnings, code")
            .eq("user_id", user.id)
            .maybeSingle();

        if (mError || !mData) {
            toast({ title: "Account Error", description: "Marketer profile not found. Please contact admin.", variant: "destructive" });
            navigate("/marketer");
            return;
        }
        setMarketer(mData);
        // For now, earnings history is simulated. In a real app, this would come from a dedicated 'marketer_earnings' table.
        setEarningsHistory([
            { id: 'e1', member_name: 'Alice Smith', member_number: 'ED123456', amount: 50, earned_at: '2024-07-01T10:00:00Z', status: 'paid' },
            { id: 'e2', member_name: 'Bob Johnson', member_number: 'ED789012', amount: 50, earned_at: '2024-07-15T11:30:00Z', status: 'paid' },
            { id: 'e3', member_name: 'Charlie Brown', member_number: 'ED345678', amount: 50, earned_at: '2024-08-01T09:00:00Z', status: 'pending' },
        ]);

        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!marketer) {
        return <div className="p-8 text-center text-muted-foreground">No marketer account found.</div>;
    }

    const pendingEarnings = earningsHistory.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketer">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Earnings</h1>
                    <p className="text-muted-foreground">Overview of your referral commissions and payout status.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-l-4 border-l-emerald-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Earnings (Life)</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {marketer.total_earnings.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Accumulated from all referrals</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">KES {pendingEarnings.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Next payout scheduled: Monday</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" /> Earnings History
                    </CardTitle>
                    <CardDescription>Record of commissions earned per referred member.</CardDescription>
                </CardHeader>
                <CardContent>
                    {earningsHistory.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No earnings recorded yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] divide-y divide-border">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground">
                                        <th className="py-3 pr-3 font-semibold">Date</th>
                                        <th className="py-3 px-3 font-semibold">Referred Member</th>
                                        <th className="py-3 px-3 font-semibold">Amount</th>
                                        <th className="py-3 pl-3 font-semibold text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {earningsHistory.map(entry => (
                                        <tr key={entry.id} className="hover:bg-muted/50">
                                            <td className="py-3 pr-3 text-sm">{format(new Date(entry.earned_at), 'MMM d, yyyy')}</td>
                                            <td className="py-3 px-3 text-sm">
                                                <div className="font-medium">{entry.member_name}</div>
                                                <div className="text-xs text-muted-foreground">{entry.member_number}</div>
                                            </td>
                                            <td className="py-3 px-3 text-sm text-emerald-700">KES {entry.amount.toLocaleString()}</td>
                                            <td className="py-3 pl-3 text-sm text-right">
                                                <Badge variant={entry.status === 'paid' ? 'default' : 'secondary'} className={entry.status === 'paid' ? 'bg-green-600' : ''}>
                                                    {entry.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}