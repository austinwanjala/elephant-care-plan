import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    DollarSign,
    Share2,
    TrendingUp,
    Calendar,
    Copy,
    Loader2,
    CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function MarketerDashboard() {
    const [loading, setLoading] = useState(true);
    const [marketer, setMarketer] = useState<any>(null);
    const [referrals, setReferrals] = useState<any[]>([]);
    const [stats, setStats] = useState({
        activeCount: 0,
        totalLifeEarnings: 0,
        totalPaid: 0,
        claimable: 0,
        pendingClaims: 0,
        commissionRate: 0
    });
    const { toast } = useToast();

    useEffect(() => {
        loadMarketerData();
    }, []);

    const loadMarketerData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // Redirect handled by layout or route protection usually
                return;
            }

            // 1. Get Marketer Profile
            const { data: mData, error: mError } = await supabase
                .from("marketers")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            if (mError) throw mError;
            if (!mData) {
                toast({ title: "Account Error", description: "Marketer profile not found.", variant: "destructive" });
                return;
            }
            setMarketer(mData);

            // 2. Get Commission Config
            const { data: configData } = await (supabase as any)
                .from("marketer_commission_config")
                .select("commission_per_referral")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            const rate = configData?.commission_per_referral || 0;

            // 3. Get Referrals
            const { data: members, error: membersError } = await supabase
                .from("members")
                .select("id, full_name, created_at, is_active")
                .eq("marketer_id", mData.id)
                .order("created_at", { ascending: false });

            if (membersError) throw membersError;

            setReferrals(members || []);

<<<<<<< HEAD
            // 4. Calculate Stats
            const activeCount = members?.filter((m: any) => m.is_active).length || 0;
            const lifeEarnings = activeCount * rate;

            // 5. Get Claims History for payouts
            const { data: claims } = await (supabase as any)
                .from("marketer_claims")
                .select("amount, status")
                .eq("marketer_id", mData.id);

            const totalPaid = claims?.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
            const pendingClaims = claims?.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + c.amount, 0) || 0;

            // Claimable = LifeEarnings - Paid - Pending
            // Ensure we don't show negative if something is out of sync
            const claimable = Math.max(0, lifeEarnings - totalPaid - pendingClaims);

            setStats({
                activeCount,
                totalLifeEarnings: lifeEarnings,
                totalPaid,
                claimable,
                pendingClaims,
                commissionRate: rate
=======
            // Calculate total earnings from commissions
            const { data: commissionsData } = await (supabase as any)
                .from("marketer_commissions")
                .select("amount, status")
                .eq("marketer_id", mData.id);

            const totalEarnings = (commissionsData || [])
                .filter((c: any) => c.status === 'paid')
                .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

            const pendingEarnings = (commissionsData || [])
                .filter((c: any) => c.status === 'unclaimed' || c.status === 'claimed')
                .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

            setStats({
                memberCount: members?.length || 0,
                totalEarnings: totalEarnings,
                pendingPayout: pendingEarnings
>>>>>>> 9ce1b7bf4df1d33d0fb034d895010586efa5354c
            });

        } catch (error: any) {
            toast({ title: "Error loading dashboard", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const copyReferralLink = () => {
        const link = `${window.location.origin}/register?ref=${marketer?.code}`;
        navigator.clipboard.writeText(link);
        toast({ title: "Link Copied!", description: "Share this link with potential members." });
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    if (!marketer) return <div className="p-8 text-center text-muted-foreground">No marketer account found.</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-blue-900">Marketer Portal</h1>
                    <p className="text-muted-foreground">Referral tracking and earnings overview.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-sm py-1 px-3">
                        Marketer Code: {marketer.code}
                    </Badge>
                </div>
            </div>

            <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl border-0 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Share2 className="h-32 w-32" />
                </div>
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-medium opacity-90">Your Referral Link</h2>
                            <p className="text-2xl font-bold truncate max-w-md bg-white/10 p-3 rounded-lg border border-white/20 font-mono text-sm uppercase">
                                {window.location.origin}/register?ref={marketer.code}
                            </p>
                        </div>
                        <Button onClick={copyReferralLink} variant="secondary" className="bg-white text-blue-700 hover:bg-blue-50 font-bold shrink-0">
                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeCount}</div>
                        <p className="text-xs text-muted-foreground mt-1 text-blue-600 font-medium">
                            @ KES {stats.commissionRate.toLocaleString()} each
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700">KES {stats.totalLifeEarnings.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Paid: KES {stats.totalPaid.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-orange-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Available to Claim</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">KES {stats.claimable.toLocaleString()}</div>
                        <div className="flex gap-2 mt-2">
                            <Link to="/marketer/earnings">
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                    View Details
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-100">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle>My Referrals</CardTitle>
                    <CardDescription>Members registered using your unique link.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {referrals.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No members referred yet. Get started by sharing your link!</div>
                        ) : (
                            referrals.map((ref) => (
                                <div key={ref.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                                            {ref.full_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">{ref.full_name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <Calendar className="h-3 w-3" />
                                                Joined {new Date(ref.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant={ref.is_active ? "default" : "secondary"} className={ref.is_active ? "bg-green-600" : ""}>
                                        {ref.is_active ? "Active" : "Incomplete"}
                                    </Badge>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}