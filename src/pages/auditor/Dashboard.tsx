import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users,
    Activity,
    TrendingUp,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from "recharts";

export default function AuditorDashboard() {
    const [highCostMembers, setHighCostMembers] = useState<any[]>([]);
    const [branchPerformance, setBranchPerformance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState([
        { title: "Total Revenue", value: "...", icon: DollarSign, description: "Member Contributions" },
        { title: "Active Members", value: "...", icon: Users, description: "Total registered" },
        { title: "Visits Today", value: "...", icon: Activity, description: "Across all branches" },
        { title: "Total P&L", value: "...", icon: TrendingUp, description: "Net Performance" },
    ]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Total Revenue (Member Payments)
            const { data: paymentsData } = await supabase
                .from("payments")
                .select("amount")
                .eq("status", "completed");

            const totalRevenue = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

            // 2. Active Members
            const { count: activeMembersCount } = await supabase
                .from("members")
                .select("*", { count: "exact", head: true })
                .eq("is_active", true);

            // 3. Visits Today
            const todayStart = startOfDay(new Date()).toISOString();
            const todayEnd = endOfDay(new Date()).toISOString();
            const { count: visitsTodayCount } = await supabase
                .from("visits")
                .select("*", { count: "exact", head: true })
                .gte("created_at", todayStart)
                .lte("created_at", todayEnd);

            // 4. Branch Performance & Total P&L
            const { data: branches } = await supabase.from("branches").select("id, name");
            const { data: revenueData } = await supabase.from("branch_revenue").select("*");

            let totalPnL = 0;
            const performanceData = branches?.map(branch => {
                const branchRevenues = revenueData?.filter(r => r.branch_id === branch.id) || [];
                const netPnL = branchRevenues.reduce((sum, r) => sum + (r.total_profit_loss || 0), 0);
                const totalRev = branchRevenues.reduce((sum, r) => sum + (r.total_compensation || 0), 0); // Assuming simplified for now

                totalPnL += netPnL;

                return {
                    name: branch.name,
                    pnl: netPnL,
                    revenue: totalRev
                };
            }) || [];

            setBranchPerformance(performanceData);

            // 5. High Cost Members (Recently)
            // Fetching more details to be useful
            const { data: highCostData } = await supabase
                .from("visits")
                .select("id, created_at, benefit_deducted, members(full_name, membership_level), branches(name)")
                .order("benefit_deducted", { ascending: false })
                .limit(5);

            setHighCostMembers(highCostData || []);

            setStats([
                {
                    title: "Total Revenue",
                    value: `KES ${totalRevenue.toLocaleString()}`,
                    icon: DollarSign,
                    description: "Member Contributions"
                },
                {
                    title: "Active Members",
                    value: activeMembersCount?.toString() || "0",
                    icon: Users,
                    description: "Total registered"
                },
                {
                    title: "Visits Today",
                    value: visitsTodayCount?.toString() || "0",
                    icon: Activity,
                    description: "Across all branches"
                },
                {
                    title: "Total P&L",
                    value: `KES ${totalPnL.toLocaleString()}`,
                    icon: TrendingUp,
                    description: "Net Performance"
                },
            ]);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Auditor Dashboard</h1>
                    <p className="text-muted-foreground">Overview of financial and operational metrics</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Profit & Loss (Branch Performance)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">Loading chart...</div>
                            ) : branchPerformance.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={branchPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `K${value / 1000}k`}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Net P&L']}
                                            cursor={{ fill: 'transparent' }}
                                        />
                                        <ReferenceLine y={0} stroke="#000" />
                                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                            {branchPerformance.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#16a34a' : '#dc2626'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground">No performance data available</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Highest Cost Visits</CardTitle>
                        <p className="text-xs text-muted-foreground">Top benefits usage recently</p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {highCostMembers.map((item, i) => (
                                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{item.members?.full_name}</p>
                                        <div className="flex gap-2">
                                            <p className="text-[10px] text-muted-foreground capitalize">{item.members?.membership_level?.replace('_', ' ')}</p>
                                            <span className="text-[10px] text-muted-foreground">•</span>
                                            <p className="text-[10px] text-muted-foreground">{item.branches?.name}</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            {format(new Date(item.created_at), "MMM d, yyyy")}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-red-600">
                                            - KES {item.benefit_deducted?.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {highCostMembers.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
