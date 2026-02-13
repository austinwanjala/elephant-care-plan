import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Stethoscope,
    Calendar,
    ArrowUpRight,
    Loader2,
    DollarSign,
    ClipboardList,
    Clock,
    User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";

export default function DirectorDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        visitCount: 0,
        newMembers: 0,
        profitLoss: 0,
        totalServices: 0,
        totalAppts: 0,
        completedAppts: 0,
        cancelledAppts: 0,
        noShowAppts: 0,
        confirmedAppts: 0
    });
    const [recentVisits, setRecentVisits] = useState<any[]>([]);
    const [upcomingAppts, setUpcomingAppts] = useState<any[]>([]);
    const [branchName, setBranchName] = useState("Loading...");
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
            const bill = (visit.bills as any)?.[0];
            if (bill) {
                totalRevenue += Number(bill.total_branch_compensation);
                totalProfitLoss += Number(bill.total_profit_loss);
                totalServicesCount += 1; // Count each visit as a service
            }
        });

        // Fetch new members for this branch
        const { count: newMembersCount } = await supabase
            .from("members")
            .select('*', { count: 'exact', head: true })
            .eq("branch_id", branchId)
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        // Fetch Appointments Analytics - Showing ALL for stats, but highlighting logic
        const { data: apptData } = await supabase
            .from("appointments")
            .select("status")
            .eq("branch_id", branchId)
            .gte("appointment_date", startOfMonthDate)
            .lte("appointment_date", endOfMonthDate);

        const totalAppts = apptData?.filter(a => a.status !== 'pending').length || 0; // Exclude pending from total count for simpler view if requested
        const completedAppts = apptData?.filter(a => a.status === 'completed' || a.status === 'checked_in').length || 0;
        const cancelledAppts = apptData?.filter(a => a.status === 'cancelled').length || 0;
        const noShowAppts = apptData?.filter(a => a.status === 'no_show').length || 0;
        const confirmedAppts = apptData?.filter(a => a.status === 'confirmed').length || 0;

        // Fetch Upcoming Confirmed Appointments (Next 5)
        const today = new Date().toISOString().split('T')[0];
        const { data: upcomingData } = await supabase
            .from("appointments")
            .select("id, appointment_date, start_time, status, members(full_name), dependants(full_name)")
            .eq("branch_id", branchId)
            .eq("status", "confirmed")
            .gte("appointment_date", today)
            .order("appointment_date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(5);

        setUpcomingAppts(upcomingData || []);

        setStats({
            totalRevenue: totalRevenue,
            visitCount: totalVisitsCount,
            newMembers: newMembersCount || 0,
            profitLoss: totalProfitLoss,
            totalServices: totalServicesCount,
            totalAppts,
            completedAppts,
            cancelledAppts,
            noShowAppts,
            confirmedAppts
        });
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    return (
        <div className="space-y-8 p-4 md:p-8 bg-slate-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900">Branch Overview</h1>
                    <p className="text-slate-500 mt-1">{branchName} Performance Metrics</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm text-slate-600 font-medium">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <DashboardCard
                    title="Revenue"
                    value={`KES ${stats.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    trend="+12% vs last month"
                    color="blue"
                />
                <DashboardCard
                    title="Active Visits"
                    value={stats.visitCount}
                    icon={ClipboardList}
                    trend="+8% vs last month"
                    color="emerald"
                />
                <DashboardCard
                    title="Services Rendered"
                    value={stats.totalServices}
                    icon={Stethoscope}
                    trend="Procedures"
                    color="purple"
                />
                <DashboardCard
                    title="Confirmed Appts"
                    value={stats.confirmedAppts}
                    icon={Calendar}
                    trend="Upcoming & Completed"
                    color="indigo"
                />
            </div>

            <div className="grid gap-6 md:grid-cols-7">
                {/* Upcoming Appointments List */}
                <Card className="md:col-span-3 shadow-md border-none card-elevated">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
                                <CardDescription>Next confirmed visits</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => navigate("/director/appointments")}>View All</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingAppts.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 border rounded-lg border-dashed">No upcoming appointments.</p>
                            ) : (
                                upcomingAppts.map((appt) => (
                                    <div key={appt.id} className="flex items-center gap-4 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                                        <div className="flex-shrink-0 text-center w-14 bg-indigo-50 text-indigo-700 rounded p-1">
                                            <div className="font-bold text-lg">{format(new Date(appt.appointment_date), "dd")}</div>
                                            <div className="text-[10px] uppercase font-bold">{format(new Date(appt.appointment_date), "MMM")}</div>
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-medium truncate">
                                                {appt.dependants?.full_name ? `${appt.dependants.full_name} (Child)` : appt.members?.full_name}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <Clock className="w-3 h-3" />
                                                {appt.start_time.slice(0, 5)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Visits List */}
                <Card className="md:col-span-4 shadow-md border-none card-elevated">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Recent Visits</CardTitle>
                                <CardDescription>Latest patient activity</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentVisits.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No recent visits recorded.</p>
                            ) : (
                                recentVisits.slice(0, 5).map((visit) => (
                                    <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                                                {visit.members?.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{visit.members?.full_name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{new Date(visit.created_at).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={visit.status === 'completed' ? 'default' : 'secondary'} className="mb-1">
                                                {visit.status}
                                            </Badge>
                                            {visit.bills?.[0] && (
                                                <div className="text-xs font-bold text-emerald-600">
                                                    KES {visit.bills[0].total_branch_compensation.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function DashboardCard({ title, value, icon: Icon, trend, color }: any) {
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-100",
        emerald: "text-emerald-600 bg-emerald-100",
        purple: "text-purple-600 bg-purple-100",
        indigo: "text-indigo-600 bg-indigo-100",
    };

    return (
        <Card className="shadow-sm border-none card-elevated hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`p-2 rounded-full ${colorClasses[color]}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-2">
                    {trend.includes('+') ? <ArrowUpRight className="h-3 w-3 mr-1 text-emerald-500" /> : null}
                    {trend}
                </p>
            </CardContent>
        </Card>
    );
}