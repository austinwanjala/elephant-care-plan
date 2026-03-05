import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Stethoscope,
    Calendar,
    ArrowUpRight,
    ArrowRight,
    TrendingUp,
    Loader2,
    DollarSign,
    ClipboardList,
    Clock,
    User,
    Activity,
    Building2,
    FileText,
    UserPlus,
    Target,
    BarChart
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
    const [branchId, setBranchId] = useState<string | null>(null);
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
            setBranchId(staffData.branch_id);
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
                        className="card-premium-blue h-full"
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
                                    className="card-premium-emerald h-full"
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
                        className="card-premium-violet h-full"
                    />
                    <DashboardCard
                        title="Patient Retention"
                        value={`${((stats.visitCount / (stats.totalAppts || 1)) * 100).toFixed(0)}%`}
                        icon={TrendingUp}
                        trend="Turnout rate"
                        color="orange"
                        className="card-premium-amber h-full"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-start relative z-10">
                    <Card className="lg:col-span-4 card-premium group overflow-hidden">
                        <CardHeader className="header-gradient-emerald border-b border-emerald-100/30 p-8 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-serif font-black text-slate-900">Revenue Analytics</CardTitle>
                                <p className="text-slate-400 text-sm font-medium mt-1">Earnings breakdown from completed clinical steps</p>
                            </div>
                            <div className="p-3 icon-glow-emerald rounded-full transition-all duration-300 group-hover:scale-110">
                                <TrendingUp className="h-5 w-5" />
                            </div>
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
                        <Card className="card-premium-dark text-white group relative overflow-hidden h-fit">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -mr-32 -mt-32 animate-pulse" />
                            <CardHeader className="p-8 relative z-10 bg-white/5 border-b border-white/5">
                                <CardTitle className="text-xl font-black text-white/90">Clinical Summary</CardTitle>
                                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">Efficiency Metrics</p>
                            </CardHeader>
                            <CardContent className="p-8 relative z-10 space-y-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/5 transition-all group-hover:bg-white/15">
                                        <div className="text-3xl font-black">{stats.visitCount}</div>
                                        <div className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mt-1">Sessions</div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/5 transition-all group-hover:bg-white/15">
                                        <div className="text-3xl font-black">{stats.totalAppts}</div>
                                        <div className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mt-1">Bookings</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-indigo-200">Appointment Completion</span>
                                        <span className="text-white">{Math.round((stats.completedAppts / (stats.totalAppts || 1)) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
                                        <div className="h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: `${(stats.completedAppts / (stats.totalAppts || 1)) * 100}%` }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {branchId && (
                            <BranchReportModal
                                branchId={branchId}
                                branchName={branchName}
                                stats={stats}
                                recentVisits={recentVisits}
                            />
                        )}

                        <Card className="card-premium h-full">
                            <CardHeader className="p-8 header-gradient-blue border-b border-blue-100/30">
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
    const glowClasses: any = {
        blue: "icon-glow-blue",
        emerald: "icon-glow-emerald",
        violet: "icon-glow-violet",
        purple: "icon-glow-violet",
        amber: "icon-glow-amber",
        orange: "icon-glow-amber",
        rose: "icon-glow-rose",
    };

    const headerGradients: any = {
        blue: "header-gradient-blue",
        emerald: "header-gradient-emerald",
        violet: "header-gradient-violet",
        purple: "header-gradient-violet",
        amber: "header-gradient-amber",
        orange: "header-gradient-amber",
        rose: "header-gradient-rose",
    };

    return (
        <Card
            className={cn(
                "group transition-all duration-500",
                className
            )}
            onClick={onClick}
        >
            <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-2 border-b border-opacity-10", headerGradients[color])}>
                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{title}</CardTitle>
                <div className={cn("p-2 rounded-xl transition-all duration-300 group-hover:scale-110", glowClasses[color] || "bg-slate-100 text-slate-600")}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="text-3xl font-black text-slate-900 leading-none">{value}</div>
                <p className="text-[10px] text-slate-400 flex items-center mt-3 font-black uppercase tracking-tighter">
                    {trend && trend.includes('+') ? <ArrowUpRight className="h-3 w-3 mr-1 text-emerald-500" /> : null}
                    {trend}
                </p>
            </CardContent>
        </Card>
    );
}

function BranchReportModal({ branchId, branchName, stats, recentVisits }: any) {
    const [isOpen, setIsOpen] = useState(false);

    const metrics = [
        { label: "Gross Revenue", value: `KES ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: "blue" },
        { label: "Clinical Visits", value: stats.visitCount, icon: Stethoscope, color: "emerald" },
        { label: "New Patients", value: stats.newMembers, icon: UserPlus, color: "violet" },
        { label: "Net Margin", value: `KES ${stats.profitLoss.toLocaleString()}`, icon: TrendingUp, color: "amber" },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full card-premium-blue h-24 rounded-3xl group relative overflow-hidden flex flex-col items-start p-6 border-none text-left">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -mr-16 -mt-16 transition-all group-hover:bg-blue-500/20" />
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 mb-1">Periodic Analytics</div>
                    <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                        Generate Branch Report <FileText className="h-4 w-4 text-blue-500" />
                    </div>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-50 border-none rounded-[3rem] p-0 shadow-2xl">
                <div className="header-gradient-blue p-10 pb-20 border-b border-blue-100/20">
                    <DialogHeader>
                        <DialogTitle className="text-4xl font-serif font-black text-slate-900">Branch Intelligence Report</DialogTitle>
                        <DialogDescription className="text-slate-500 text-lg font-medium italic">
                            Detailed operational & financial audit for {branchName} - {format(new Date(), "MMMM yyyy")}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-10 -mt-12 space-y-10 pb-12">
                    {/* Key Core Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {metrics.map((m, i) => (
                            <Card key={i} className="card-premium border-none shadow-xl">
                                <CardContent className="p-6">
                                    <div className={cn("inline-flex p-3 rounded-2xl mb-4",
                                        m.color === 'blue' ? "bg-blue-100 text-blue-600" :
                                            m.color === 'emerald' ? "bg-emerald-100 text-emerald-600" :
                                                m.color === 'violet' ? "bg-violet-100 text-violet-600" :
                                                    "bg-amber-100 text-amber-600"
                                    )}>
                                        <m.icon className="h-5 w-5" />
                                    </div>
                                    <div className="text-2xl font-black text-slate-900 leading-none mb-1">{m.value}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Visit Distribution */}
                        <Card className="card-premium h-full">
                            <CardHeader className="p-8 border-b border-slate-100">
                                <CardTitle className="text-xl font-black text-slate-800">Operational Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-500">Completed Visits</span>
                                        <span className="text-sm font-black text-emerald-600">{stats.visitCount}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${(stats.visitCount / (stats.totalAppts || 1)) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-500">Confirmed Appointments</span>
                                        <span className="text-sm font-black text-blue-600">{stats.confirmedAppts}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${(stats.confirmedAppts / (stats.totalAppts || 1)) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-500">Cancellations & No-Shows</span>
                                        <span className="text-sm font-black text-rose-600">{stats.cancelledAppts + stats.noShowAppts}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500" style={{ width: `${((stats.cancelledAppts + stats.noShowAppts) / (stats.totalAppts || 1)) * 100}%` }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Financial Efficiency */}
                        <Card className="card-premium h-full">
                            <CardHeader className="p-8 border-b border-slate-100">
                                <CardTitle className="text-xl font-black text-slate-800">Financial Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="flex items-center justify-between p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                                    <div>
                                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Average per Visit</div>
                                        <div className="text-2xl font-black text-slate-900">KES {(stats.totalRevenue / (stats.visitCount || 1)).toLocaleString()}</div>
                                    </div>
                                    <div className="h-12 w-12 rounded-2xl bg-white border border-blue-100 flex items-center justify-center">
                                        <Target className="h-6 w-6 text-blue-600" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100">
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Profitability Ratio</div>
                                        <div className="text-2xl font-black text-slate-900">{((stats.profitLoss / (stats.totalRevenue || 1)) * 100).toFixed(1)}%</div>
                                    </div>
                                    <div className="h-12 w-12 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center">
                                        <BarChart className="h-6 w-6 text-emerald-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Activity Log */}
                    <Card className="card-premium">
                        <CardHeader className="p-8 border-b border-slate-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-black text-slate-800">Clinical Data Stream</CardTitle>
                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-bold px-3">Latest {recentVisits.length} Records</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest text-slate-400 py-4">Date</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Patient</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Status</TableHead>
                                        <TableHead className="text-right pr-8 font-black uppercase text-[10px] tracking-widest text-slate-400">Compensation</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentVisits.slice(0, 15).map((visit: any) => (
                                        <TableRow key={visit.id} className="hover:bg-slate-50/30 transition-colors border-b-slate-100/30">
                                            <TableCell className="pl-8 py-4">
                                                <div className="font-black text-slate-700 text-sm">{format(new Date(visit.created_at), "dd/MM/yyyy")}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(visit.created_at), "HH:mm")}</div>
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-600 text-xs">{visit.members?.full_name}</TableCell>
                                            <TableCell>
                                                <Badge className={cn("text-[9px] font-black uppercase tracking-tighter h-5",
                                                    visit.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                                )}>
                                                    {visit.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8 font-black text-slate-900">
                                                KES {Number((visit.bills as any)?.[0]?.total_branch_compensation || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div className="p-8 bg-slate-900 text-center">
                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-xl px-10 h-12 font-black uppercase tracking-[0.2em] text-xs" onClick={() => setIsOpen(false)}>
                        Dismiss Report View
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}