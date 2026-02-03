import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    DollarSign,
    Link2,
    TrendingUp,
    Copy,
    CheckCircle2,
    Loader2,
    BarChart3
} from "lucide-react";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function MarketerDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalReferrals: 0,
        activeReferrals: 0,
        totalEarnings: 0,
        pendingPayout: 0
    });
    const [referralLink, setReferralLink] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        fetchMarketerData();
    }, []);

    const fetchMarketerData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // @ts-ignore
                const { data: marketer } = await supabase
                    .from("marketers")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (marketer) {
                    setStats({
                        totalReferrals: marketer.total_members || 0,
                        activeReferrals: Math.floor((marketer.total_members || 0) * 0.8), // Mock active ratio
                        totalEarnings: marketer.total_earnings || 0,
                        pendingPayout: 5000 // Mock
                    });
                    setReferralLink(`${window.location.origin}/register?ref=${marketer.referral_code || 'MARKETER'}`);
                }
            }
        } catch (error) {
            console.error("Error fetching marketer data:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(referralLink);
        toast({
            title: "Link Copied!",
            description: "Referral link copied to clipboard.",
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Marketing Dashboard</h1>
                    <p className="text-muted-foreground">Track your referrals and commission earnings.</p>
                </div>
            </div>

            <Card className="bg-purple-50 border-purple-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-800">Your Referral Link</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <div className="bg-white border rounded px-3 py-2 flex-grow font-mono text-sm truncate">
                            {referralLink || "Loading..."}
                        </div>
                        <Button onClick={copyLink} className="bg-purple-600 hover:bg-purple-700 shrink-0">
                            <Copy className="mr-2 h-4 w-4" /> Copy
                        </Button>
                    </div>
                    <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Share this link to earn commission on every member you bring in.
                    </p>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalReferrals}</div>
                        <p className="text-xs text-muted-foreground">Members brought in</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeReferrals}</div>
                        <p className="text-xs text-muted-foreground">Paying subscribers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {stats.totalEarnings.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Cumulative commissions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">KES {stats.pendingPayout.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Available for withdrawal</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Referral Activity</CardTitle>
                        <CardDescription>Members joined using your link over time.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center border-t">
                        <div className="text-muted-foreground flex flex-col items-center">
                            <BarChart3 className="h-12 w-12 mb-2 opacity-20" />
                            <p>Activity Chart Placeholder</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Conversions</CardTitle>
                        <CardDescription>Latest successfully registered members.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { name: "John Kamau", date: "2024-02-01", status: "Active" },
                                { name: "Sarah Otieno", date: "2024-01-30", status: "Pending" },
                                { name: "Paul Mwangi", date: "2024-01-28", status: "Active" },
                            ].map((ref, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{ref.name}</p>
                                        <p className="text-xs text-muted-foreground">{ref.date}</p>
                                    </div>
                                    <Badge variant={ref.status === "Active" ? "default" : "secondary"}>{ref.status}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
