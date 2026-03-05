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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Activity, Building2 } from "lucide-react";

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
        confirmedAppts: 0,
        activeVisitsCount: 0
    });
    const [recentVisits, setRecentVisits] = useState<any[]>([]);
    const [upcomingAppts, setUpcomingAppts] = useState<any[]>([]);
    const [activeVisitsList, setActiveVisitsList] = useState<any[]>([]);
    const [isVisiListOpen, setIsVisitListOpen] = useState(false);
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

        // Fetch ALL active visits for this branch (ignoring month for "right now" view)
        const { data: activeData } = await supabase
            .from("visits")
            .select("*, members(full_name), staff:assigned_doctor_id(full_name)")
            .eq("branch_id", branchId)
            .not("status", "eq", "completed")
            .not("status", "eq", "cancelled")
            .order("created_at", { ascending: false });

        setActiveVisitsList(activeData || []);

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
            confirmedAppts,
            activeVisitsCount: activeData?.length || 0
        });
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    return (
        <div className="dashboard-luxury-bg p-4 md:p-8 min-h-screen">
            <div className="soft-glow-emerald top-[-5%] left-[-5%]" />
            <div className="soft-glow-blue bottom-[-5%] right-[-5%]" />

            <div className="flex flex-col gap-8 relative z-10 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900 leading-tight">Branch Performance</h1>
                        <p className="text-slate-500 mt-1 font-medium italic">Comprehensive oversight for {branchName}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-200 shadow-xl shadow-slate-100/50 text-slate-700 font-black text-sm uppercase tracking-wider">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <DashboardCard
                        title="Monthly Revenue"
                        value={`KES ${stats.totalRevenue.toLocaleString()}`}
                        icon={DollarSign}
                        trend="+12% vs last month"
                        color="blue"
                        className="bg-white/70 backdrop-blur-xl border-blue-100 shadow-lg shadow-blue-50/50 rounded-3xl"
                    />
                    <Dialog open={isVisiListOpen} onOpenChange={setIsVisitListOpen}>
                        <DialogTrigger asChild>
                            <div className="cursor-pointer group transform transition-all hover:scale-[1.02]">
                                <DashboardCard
                                    title="Active clinical sessions"
                                    value={stats.activeVisitsCount}
                                    icon={Activity}
                                    trend="Live facility tracking"
                                    color="emerald"
                                    onClick={() => setIsVisitListOpen(true)}
                                    className="bg-white/70 backdrop-blur-xl border-emerald-100 shadow-lg shadow-emerald-50/50 rounded-3xl"
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white/95 backdrop-blur-2xl border-slate-100 rounded-[2rem] shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between text-2xl font-black pr-6 text-slate-900 font-serif">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-100 rounded-xl">
                                            <Activity className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        Active Clinical Tracking
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-[10px] uppercase border-blue-200 text-blue-700 bg-blue-50 font-black h-8 rounded-lg hover:bg-blue-100"
                                        onClick={() => navigate("/director/visits")}
                                    >
                                        Full History <ArrowRight className="ml-1 h-3 w-3" />
                                    </Button>
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 font-medium">
                                    Real-time monitoring of patients currently in {branchName} dental care path.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-6 border border-slate-100 rounded-2xl overflow-hidden shadow-xl bg-white">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest pl-6">Patient</TableHead>
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Medical Officer</TableHead>
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Arrival</TableHead>
                                            <TableHead className="text-right font-black text-slate-600 uppercase text-[10px] tracking-widest pr-6">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeVisitsList.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-48 text-center text-slate-400 font-bold italic">
                                                    No clinical sessions active currently.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activeVisitsList.map((visit) => (
                                                <TableRow key={visit.id} className="group hover:bg-slate-50/50 transition-colors border-b-slate-100/50">
                                                    <TableCell className="font-black text-slate-800 text-sm pl-6">
                                                        {visit.members?.full_name || "Guest Patient"}
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 text-xs font-medium">
                                                        {visit.staff?.full_name ? `Dr. ${visit.staff.full_name}` : (
                                                            <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-100 font-black text-[9px] uppercase">Awaiting Doc</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-slate-400 text-xs font-black">
                                                        {format(new Date(visit.created_at), "HH:mm")}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Badge className={cn(
                                                            "font-black text-[9px] uppercase h-5 px-2 rounded-lg",
                                                            visit.status === 'in_progress' ? "bg-emerald-100 text-emerald-700" :
                                                                visit.status === 'arrived' ? "bg-blue-100 text-blue-700" :
                                                                    "bg-amber-100 text-amber-700"
                                                        )}>
                                                            {visit.status.replace('_', ' ')}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <Button variant="ghost" className="text-xs font-black uppercase text-slate-400 hover:text-slate-900" onClick={() => setIsVisitListOpen(false)}>Close Activity Monitor</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <DashboardCard
                        title="Enrollment"
                        value={stats.newMembers}
                        icon={Users}
                        trend="New for this month"
                        color="purple"
                        className="bg-white/70 backdrop-blur-xl border-violet-100 shadow-lg shadow-violet-50/50 rounded-3xl"
                    />
                    <DashboardCard
                        title="Patient Retention"
                        value={`${((stats.visitCount / (stats.totalAppts || 1)) * 100).toFixed(0)}%`}
                        icon={TrendingUp}
                        trend="Turnout rate"
                        color="orange"
                        className="bg-white/70 backdrop-blur-xl border-orange-100 shadow-lg shadow-orange-50/50 rounded-3xl"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-start relative z-10">
                    <Card className="lg:col-span-4 bg-white/70 backdrop-blur-xl border-slate-100 shadow-2xl rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100/50 p-8 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-serif font-black text-slate-900">Revenue Analytics</CardTitle>
                                <p className="text-slate-400 text-sm font-medium mt-1">Earnings breakdown from completed clinical steps</p>
                            </div>
                            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200">
                                <TrendingUp className="h-5 w-5 text-emerald-500" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/30">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest pl-8 py-5">Treatment Date</TableHead>
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Client</TableHead>
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest text-right">Revenue</TableHead>
                                            <TableHead className="font-black text-slate-600 uppercase text-[10px] tracking-widest text-right pr-8">Margin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentVisits.filter(v => v.status === 'completed').length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-48 text-center text-slate-400 font-bold italic">
                                                    No financial records logged this month.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            recentVisits.filter(v => v.status === 'completed').slice(0, 8).map((visit) => {
                                                const bill = (visit.bills as any)?.[0];
                                                return (
                                                    <TableRow key={visit.id} className="group hover:bg-emerald-50/30 transition-colors border-b-slate-50">
                                                        <TableCell className="pl-8 py-4">
                                                            <div className="font-black text-slate-800 text-sm">{format(new Date(visit.created_at), "MMM d, yyyy")}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{format(new Date(visit.created_at), "HH:mm")}</div>
                                                        </TableCell>
                                                        <TableCell className="font-bold text-slate-600 text-xs">
                                                            {visit.members?.full_name}
                                                        </TableCell>
                                                        <TableCell className="text-right font-black text-slate-900 text-sm">
                                                            KES {Number(bill?.total_branch_compensation || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-8">
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[10px]">
                                                                KES {Number(bill?.total_profit_loss || 0).toLocaleString()}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-3 space-y-8">
                        <Card className="bg-indigo-900 text-white shadow-2xl border-0 rounded-[2.5rem] overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                <Activity className="h-32 w-32" />
                            </div>
                            <CardHeader className="p-8 relative z-10">
                                <CardTitle className="text-xl font-black text-white/90">Clinical Summary</CardTitle>
                                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">Efficiency Metrics</p>
                            </CardHeader>
                            <CardContent className="p-8 pt-0 relative z-10 space-y-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/5">
                                        <div className="text-3xl font-black">{stats.visitCount}</div>
                                        <div className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mt-1">Sessions</div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/5">
                                        <div className="text-3xl font-black">{stats.totalAppts}</div>
                                        <div className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mt-1">Bookings</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-indigo-200">Appointment Completion</span>
                                        <span className="text-white">{Math.round((stats.completedAppts / (stats.totalAppts || 1)) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(stats.completedAppts / (stats.totalAppts || 1)) * 100}%` }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <BranchReportModal
                            branchId={branchId}
                            branchName={branchName}
                            stats={stats}
                            recentVisits={recentVisits}
                        />

                        <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-2xl rounded-[2.5rem] overflow-hidden">
                            <CardHeader className="p-8 border-b border-slate-50">
                                <CardTitle className="text-xl font-serif font-black text-slate-900">Upcoming Records</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                {upcomingAppts.length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 font-bold italic text-sm">No scheduled bookings found.</p>
                                ) : (
                                    upcomingAppts.map((appt) => (
                                        <div key={appt.id} className="flex gap-4 p-4 rounded-2xl bg-white border border-slate-100 hover:border-primary/20 transition-all shadow-sm">
                                            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center font-black text-blue-600 text-xs">
                                                {appt.start_time.slice(0, 5)}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 text-sm lowercase capitalize">{appt.members?.full_name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Scheduled: {format(new Date(appt.appointment_date), "MMM d, yyyy")}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <Button
                                    variant="ghost"
                                    className="w-full text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl h-10"
                                    onClick={() => navigate("/director/appointments")}
                                >
                                    Manage Schedules <ArrowRight className="ml-2 h-3 w-3" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DashboardCard({ title, value, icon: Icon, trend, color, onClick, className }: any) {
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-100",
        emerald: "text-emerald-600 bg-emerald-100",
        purple: "text-purple-600 bg-purple-100",
        indigo: "text-indigo-600 bg-indigo-100",
    };

    return (
        <Card
            className={`shadow-sm border-none card-elevated hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`p-2 rounded-full ${colorClasses[color]}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-2 font-medium">
                    {trend.includes('+') ? <ArrowUpRight className="h-3 w-3 mr-1 text-emerald-500 font-bold" /> : null}
                    {trend}
                </p>
            </CardContent>
        </Card>
    );
}