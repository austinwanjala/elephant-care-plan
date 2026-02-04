import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, TrendingUp, History, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface MarketerInfo {
    id: string;
    code: string;
}

interface Claim {
    id: string;
    amount: number;
    referral_count: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    notes: string | null;
}

export default function MarketerEarnings() {
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [marketer, setMarketer] = useState<MarketerInfo | null>(null);
    const [commissionRate, setCommissionRate] = useState<number>(0);
    const [activeReferrals, setActiveReferrals] = useState<number>(0);
    const [claims, setClaims] = useState<Claim[]>([]);
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
            .select("id, code")
            .eq("user_id", user.id)
            .maybeSingle();

        if (mError || !mData) {
            toast({ title: "Account Error", description: "Marketer profile not found. Please contact admin.", variant: "destructive" });
            navigate("/marketer");
            return;
        }
        setMarketer(mData);

        // Fetch commission config
        const { data: configData } = await (supabase as any)
            .from("marketer_commission_config")
            .select("commission_per_referral")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (configData) {
            setCommissionRate(configData.commission_per_referral);
        }

        // Fetch active referrals count
        const { count } = await supabase
            .from("members")
            .select("id", { count: 'exact', head: true })
            .eq("marketer_id", mData.id)
            .eq("is_active", true);

        setActiveReferrals(count || 0);

        // Fetch claims history
        const { data: claimsData } = await (supabase as any)
            .from("marketer_claims")
            .select("*")
            .eq("marketer_id", mData.id)
            .order("created_at", { ascending: false });

        setClaims(claimsData || []);
        setLoading(false);
    };

    const handleSubmitClaim = async () => {
        if (!marketer || claimableAmount <= 0) {
            toast({ title: "No Claimable Amount", description: "You don't have any commission to claim.", variant: "destructive" });
            return;
        }

        setClaiming(true);
        try {
            const { error } = await (supabase as any)
                .from("marketer_claims")
                .insert({
                    marketer_id: marketer.id,
                    amount: claimableAmount,
                    referral_count: activeReferrals,
                    status: 'pending'
                });

            if (error) throw error;

            toast({ title: "Claim Submitted", description: `Your claim for KES ${claimableAmount.toLocaleString()} has been submitted for approval.` });
            fetchMarketerData();
        } catch (error: any) {
            toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        } finally {
            setClaiming(false);
        }
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

    // Calculate earnings
    const totalEarned = activeReferrals * commissionRate;
    const totalPaid = claims.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
    const pendingClaims = claims.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
    const claimableAmount = Math.max(0, totalEarned - totalPaid - pendingClaims);

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

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-blue-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeReferrals}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            @ KES {commissionRate.toLocaleString()} each
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {totalPaid.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Lifetime earnings received</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Claimable Now</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">KES {claimableAmount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {pendingClaims > 0 && `KES ${pendingClaims.toLocaleString()} pending approval`}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-lg border-primary/20">
                <CardHeader>
                    <CardTitle>Submit Commission Claim</CardTitle>
                    <CardDescription>
                        Request payment for your referral commissions. Claims are reviewed by admin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={handleSubmitClaim}
                        disabled={claiming || claimableAmount <= 0}
                        className="w-full md:w-auto"
                        size="lg"
                    >
                        {claiming ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : claimableAmount > 0 ? (
                            <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Submit Claim (KES {claimableAmount.toLocaleString()})
                            </>
                        ) : (
                            "No Amount to Claim"
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" /> Claims History
                    </CardTitle>
                    <CardDescription>Record of all commission claims you've submitted.</CardDescription>
                </CardHeader>
                <CardContent>
                    {claims.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No claims submitted yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date Submitted</TableHead>
                                        <TableHead>Referrals</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Paid Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {claims.map(claim => (
                                        <TableRow key={claim.id}>
                                            <TableCell>{format(new Date(claim.created_at), 'MMM d, yyyy')}</TableCell>
                                            <TableCell>{claim.referral_count} members</TableCell>
                                            <TableCell className="font-bold text-emerald-700">KES {claim.amount.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={claim.status === 'paid' ? 'default' : claim.status === 'pending' ? 'secondary' : 'destructive'}
                                                    className={claim.status === 'paid' ? 'bg-green-600' : ''}
                                                >
                                                    {claim.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {claim.paid_at ? format(new Date(claim.paid_at), 'MMM d, yyyy') : '-'}
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