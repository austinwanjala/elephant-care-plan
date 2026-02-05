import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    CreditCard,
    Stethoscope,
    TrendingUp,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
    DollarSign,
    ClipboardList
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function DirectorDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        visitCount: 0,
        newMembers: 0,
        profitLoss: 0,
        totalServices: 0,
    });
    const [recentVisits, setRecentVisits] = useState<any[]>([]);
    const [branchName, setBranchName] = useState("Loading...");
    const [directorBranchId, setDirectorBranchId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/login");
                return;
            }

            const { data: staffData, error: staffError } = await supabase
                .from("staff")
                .select("branch_id, branches(name)")
                .eq("user_id", user.id)
                .maybeSingle();

            if (staffError || !staffData?.branch_id) {
                toast({ title: "Access Denied", description: "You are not assigned to a branch.", variant: "destructive" });
                navigate("/");
                return;
            }

            setBranchName(staffData.branches.name);
            setDirectorBranchId(staffData.branch_id);
            await fetchMetrics(staffData.branch_id);

        } catch (error: any) {
            toast({ title: "Error loading dashboard", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const fetchMetrics = async (branchId: string) => {
        const startOfMonthDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
        const endOfMonthDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

        // Fetch visits for the current month
        const { data: visitsData, error: visitsError } = await supabase
            .from("visits")
            .select("*, members(full_name), bills(*)")
            .eq("branch_id", branchId)
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate)
            .order("created_at", { ascending: false });

        if (visitsError) throw visitsError;

        setRecentVisits(visitsData || []);

        const completedVisits = (visitsData || []).filter(v => v.status === 'completed');
        const totalVisitsCount = completedVisits.length;

        let totalRevenue = 0;
        let totalProfitLoss = 0;
        let totalServicesCount = 0;

        completedVisits.forEach(visit => {
            const bill = visit.bills?.[0];
            if (bill) {
                totalRevenue += Number(bill.total_branch_compensation);
                totalProfitLoss += Number(bill.total_profit_loss);
                totalServicesCount += (bill.bill_items?.length || 0);
            }
        });

        // Fetch new members for this branch (simplified, could be more complex with join dates)
        const { count: newMembersCount } = await supabase
            .from("members")
            .select('*', { count: 'exact', head: true })
            .eq("branch_id", branchId)
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        setStats({
            totalRevenue: totalRevenue,
            visitCount: totalVisitsCount,
            newMembers: newMembersCount || 0,
            profitLoss: totalProfitLoss,
            totalServices: totalServicesCount,
        });
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-blue-900">Branch Overview</h1>
                    <p className="text-muted-foreground">{branchName} Performance Metrics</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-blue-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Branch Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <span className="text-green-600 flex items-center mr-1 font-medium">
                                <ArrowUpRight className="h-3 w-3 mr-0.5" /> 12%
                            </span>
                            from last month
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                        <ClipboardList className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.visitCount}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <span className="text-green-600 flex items-center mr-1 font-medium">
                                <ArrowUpRight className="h-3 w-3 mr-0.5" /> 8%
                            </span>
                            daily average: {(stats.visitCount / 30).toFixed(1)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            KES {stats.profitLoss.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            {stats.profitLoss >= 0 ? 'Positive margin' : 'Deficit detected'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Services Rendered</CardTitle>
                        <Stethoscope className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalServices}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total procedures this month</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 shadow-sm border-blue-50">
                    <CardHeader>
                        <CardTitle>Recent Patient Visits</CardTitle>
                        <CardDescription>Last active consultations in this branch.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentVisits.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No recent visits recorded.</p>
                            ) : (
                                recentVisits.map((visit) => (
                                    <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/30">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                                                {visit.members?.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{visit.members?.full_name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{new Date(visit.created_at).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant={visit.status === 'completed' ? 'default' : 'secondary'} className={visit.status === 'completed' ? 'bg-green-600' : ''}>
                                                {visit.status}
                                            </Badge>
                                            {visit.bills?.[0] && (
                                                <span className="text-xs font-bold text-blue-700">
                                                    KES {visit.bills[0].total_branch_compensation.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 shadow-sm border-slate-100">
                    <CardHeader>
                        <CardTitle>Top Services Offered</CardTitle>
                        <CardDescription>By frequency this month.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6 mt-2">
                            <div className="text-center text-muted-foreground py-8">
                                Service distribution data will be displayed here.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}