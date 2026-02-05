import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, TrendingUp, CalendarDays, History } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
    status: string; // e.g., 'active' -> 'Earned', 'inactive' -> 'Pending'
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

        // Fetch referred members to construct earnings history
        // Assuming there isn't a direct "commissions" table, we use the members table
        // where marketer_id matches.
        const { data: membersData, error: membersError } = await supabase
            .from("members")
            .select("id, full_name, member_number, created_at, is_active")
            .eq("marketer_id", mData.id)
            .order("created_at", { ascending: false });

        if (membersError) {
            console.error("Error fetching referrals:", membersError);
        } else if (membersData) {
            const mappedHistory: EarningsEntry[] = membersData.map(m => ({
                id: m.id,
                member_name: m.full_name,
                member_number: m.member_number,
                amount: 500, // Fixed commission amount for now, or could vary
                earned_at: m.created_at,
                status: m.is_active ? 'Earned' : 'Pending Activation'
            }));
            setEarningsHistory(mappedHistory);
        }

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

    // Calculate pending earnings from our history list
    const pendingEarnings = earningsHistory
        .filter(e => e.status === 'Pending Activation')
        .reduce((sum, e) => sum + e.amount, 0);

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
                        <CardTitle className="text-sm font-medium">Total Earnings (Paid)</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {marketer.total_earnings?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Accumulated verified commissions</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Estimations</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">KES {pendingEarnings.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Potential earnings from inactive members</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" /> Earnings History
                    </CardTitle>
                    <CardDescription>Record of commissions based on your referrals.</CardDescription>
                </CardHeader>
                <CardContent>
                    {earningsHistory.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No referrals recorded yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Referred Member</TableHead>
                                        <TableHead>Est. Amount</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {earningsHistory.map(entry => (
                                        <TableRow key={entry.id} className="hover:bg-muted/50">
                                            <TableCell className="font-medium text-muted-foreground">
                                                {format(new Date(entry.earned_at), 'MMM d, yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{entry.member_name}</div>
                                                <div className="text-xs text-muted-foreground">{entry.member_number}</div>
                                            </TableCell>
                                            <TableCell className="text-emerald-700 font-semibold">
                                                KES {entry.amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant={entry.status === 'Earned' ? 'default' : 'secondary'}
                                                    className={entry.status === 'Earned' ? 'bg-green-600 hover:bg-green-700' : ''}
                                                >
                                                    {entry.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}