import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, getMonth, getYear, subMonths } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, ArrowLeft, FileText, Users, Stethoscope, DollarSign, CalendarDays,
    TrendingUp, TrendingDown, ClipboardCheck, AlertCircle, UserPlus, Target,
    PieChart, BarChart, Building2, Clock
} from "lucide-react";

interface ServiceUsage {
    service_name: string;
    count: number;
    total_benefit_cost: number;
}

interface MemberActivity {
    member_name: string;
    member_number: string;
    total_visits: number;
    total_deducted: number;
}

interface BranchStats {
    totalRevenue: number;
    totalProfit: number;
    totalVisits: number;
    completedVisits: number;
    pendingVisits: number;
    cancelledVisits: number;
    newMembers: number;
}


export default function DirectorReports() {
    const [loading, setLoading] = useState(true);
    const [serviceUsage, setServiceUsage] = useState<ServiceUsage[]>([]);
    const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1); // 1-indexed
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [directorBranchId, setDirectorBranchId] = useState<string | null>(null);
    const [stats, setStats] = useState<BranchStats>({
        totalRevenue: 0,
        totalProfit: 0,
        totalVisits: 0,
        completedVisits: 0,
        pendingVisits: 0,
        cancelledVisits: 0,
        newMembers: 0
    });
    const [doctorStats, setDoctorStats] = useState<any[]>([]);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDirectorInfo();
    }, []);

    useEffect(() => {
        if (directorBranchId) {
            fetchReportsData(directorBranchId, currentMonth, currentYear);
        }
    }, [directorBranchId, currentMonth, currentYear]);

    const fetchDirectorInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData?.branch_id) {
            toast({ title: "Access Denied", description: "You are not assigned to a branch.", variant: "destructive" });
            navigate("/");
            return;
        }
        setDirectorBranchId(staffData.branch_id);
    };

    const fetchReportsData = async (branchId: string, month: number, year: number) => {
        setLoading(true);
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd");

        // Fetch service usage
        const { data: serviceData, error: serviceError } = await supabase
            .from("visits")
            .select("bills(bill_items(service_name, benefit_cost))")
            .eq("branch_id", branchId)
            .eq("status", "completed")
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        if (serviceError) {
            toast({ title: "Error fetching service usage", description: serviceError.message, variant: "destructive" });
            setServiceUsage([]);
        } else {
            const usageMap: Record<string, ServiceUsage> = {};
            (serviceData || []).forEach(visit => {
                visit.bills?.[0]?.bill_items?.forEach((item: any) => {
                    if (!usageMap[item.service_name]) {
                        usageMap[item.service_name] = { service_name: item.service_name, count: 0, total_benefit_cost: 0 };
                    }
                    usageMap[item.service_name].count += 1;
                    usageMap[item.service_name].total_benefit_cost += Number(item.benefit_cost);
                });
            });
            setServiceUsage(Object.values(usageMap).sort((a, b) => b.count - a.count));
        }

        // Fetch member activity
        const { data: memberData, error: memberError } = await supabase
            .from("visits")
            .select("member_id, members(full_name, member_number), bills(total_benefit_cost)")
            .eq("branch_id", branchId)
            .eq("status", "completed")
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        if (memberError) {
            toast({ title: "Error fetching member activity", description: memberError.message, variant: "destructive" });
            setMemberActivity([]);
        } else {
            const activityMap: Record<string, MemberActivity> = {};
            (memberData || []).forEach(visit => {
                const memberId = visit.member_id;
                const memberName = visit.members?.full_name || "Unknown Member";
                const memberNumber = visit.members?.member_number || "N/A";
                const bill = visit.bills?.[0];

                if (!activityMap[memberId]) {
                    activityMap[memberId] = { member_name: memberName, member_number: memberNumber, total_visits: 0, total_deducted: 0 };
                }
                activityMap[memberId].total_visits += 1;
                activityMap[memberId].total_deducted += Number(bill?.total_benefit_cost || 0);
            });
            setMemberActivity(Object.values(activityMap).sort((a, b) => b.total_visits - a.total_visits));
        }

        // 3. Fetch Comprehensive Stats
        try {
            const { data: visits } = await supabase
                .from("visits")
                .select("id, status, branch_compensation, profit_loss, assigned_doctor_id, staff:assigned_doctor_id(full_name)")
                .eq("branch_id", branchId)
                .gte("created_at", startOfMonthDate)
                .lte("created_at", endOfMonthDate);

            const vData = visits || [];
            const completed = vData.filter(v => v.status === 'completed');

            const totalRev = completed.reduce((sum, v) => sum + (Number(v.branch_compensation) || 0), 0);
            const totalProf = completed.reduce((sum, v) => sum + (Number(v.profit_loss) || 0), 0);

            // Fetch new members for this branch
            const { count: newMems } = await supabase
                .from("members")
                .select("*", { count: 'exact', head: true })
                .eq("branch_id", branchId)
                .gte("created_at", startOfMonthDate)
                .lte("created_at", endOfMonthDate);

            setStats({
                totalRevenue: totalRev,
                totalProfit: totalProf,
                totalVisits: vData.length,
                completedVisits: completed.length,
                pendingVisits: vData.filter(v => v.status === 'pending' || v.status === 'in_progress').length,
                cancelledVisits: vData.filter(v => v.status === 'cancelled').length,
                newMembers: newMems || 0
            });

            // Doctor stats based on these visits
            const dMap: Record<string, any> = {};
            vData.forEach(v => {
                const dId = v.assigned_doctor_id || 'unassigned';
                const dName = v.staff?.full_name || 'Unassigned';
                if (!dMap[dId]) dMap[dId] = { name: dName, visits: 0, revenue: 0 };
                dMap[dId].visits += 1;
                if (v.status === 'completed') dMap[dId].revenue += Number(v.branch_compensation) || 0;
            });
            setDoctorStats(Object.values(dMap).sort((a, b) => b.revenue - a.revenue));

        } catch (err) {
            console.error("Error fetching stats:", err);
        }

        setLoading(false);
    };

    const getMonthOptions = () => {
        const options = [];
        let date = new Date();
        for (let i = 0; i < 12; i++) { // Last 12 months
            options.push(date);
            date = subMonths(date, 1);
        }
        return options.reverse();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Link to="/director">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white shadow-sm border">
                            <ArrowLeft className="h-5 w-5 text-slate-600" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900 font-bold">Branch Reports</h1>
                        <p className="text-slate-500 text-sm">Comprehensive performance insights and analytics</p>
                    </div>
                </div>

                <Card className="flex items-center px-4 py-2 shadow-sm border-blue-50 bg-white min-w-[200px]">
                    <CalendarDays className="h-4 w-4 text-blue-500 mr-2" />
                    <Select
                        value={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                        onValueChange={(value) => {
                            const [yearStr, monthStr] = value.split('-');
                            setCurrentYear(parseInt(yearStr));
                            setCurrentMonth(parseInt(monthStr));
                        }}
                    >
                        <SelectTrigger className="border-none focus:ring-0 shadow-none h-8 font-semibold text-slate-700">
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                            {getMonthOptions().map((date, index) => (
                                <SelectItem key={index} value={`${getYear(date)}-${(getMonth(date) + 1).toString().padStart(2, '0')}`}>
                                    {format(date, "MMM yyyy")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatSimpleCard
                    title="Gross Revenue"
                    value={`KES ${stats.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    color="blue"
                    subtitle={`${stats.completedVisits} Paid Visits`}
                />
                <StatSimpleCard
                    title="Net Profit"
                    value={`KES ${stats.totalProfit.toLocaleString()}`}
                    icon={TrendingUp}
                    color="emerald"
                    subtitle="Branch Margin"
                />
                <StatSimpleCard
                    title="Patient Traffic"
                    value={stats.totalVisits}
                    icon={Users}
                    color="purple"
                    subtitle={`${stats.newMembers} New Registrations`}
                />
                <StatSimpleCard
                    title="Completion Rate"
                    value={`${Math.round((stats.completedVisits / (stats.totalVisits || 1)) * 100)}%`}
                    icon={ClipboardCheck}
                    color="orange"
                    subtitle={`${stats.pendingVisits} Ongoing`}
                />
            </div>

            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Comprehensive Branch Summary</h3>
                    <p className="text-sm text-muted-foreground">Download or view the elaborate performance breakdown.</p>
                </div>
                <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 h-11 px-6 shadow-md hover:shadow-lg transition-all gap-2">
                            <FileText className="h-4 w-4" />
                            Generate Detailed Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Building2 className="h-6 w-6 text-blue-600" />
                                Branch Performance Report
                            </DialogTitle>
                            <DialogDescription>
                                Elaborate breakdown for {format(new Date(currentYear, currentMonth - 1), 'MMMM yyyy')}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-8 py-4">
                            {/* Executive Summary */}
                            <section>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                                    <Target className="h-4 w-4" /> Executive Summary
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 font-medium mb-1">Gross Branch Revenue</p>
                                        <p className="text-xl font-bold text-slate-900">KES {stats.totalRevenue.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 font-medium mb-1">Operational Profit</p>
                                        <p className="text-xl font-bold text-emerald-600">KES {stats.totalProfit.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 font-medium mb-1">New Members</p>
                                        <p className="text-xl font-bold text-blue-600">{stats.newMembers}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Operational Stats */}
                            <section>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                                    <PieChart className="h-4 w-4" /> Operational Efficiency
                                </h4>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                                    <div className="p-3 border rounded-lg">
                                        <div className="text-2xl font-bold">{stats.totalVisits}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Visits</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-emerald-50 border-emerald-100">
                                        <div className="text-2xl font-bold text-emerald-700">{stats.completedVisits}</div>
                                        <div className="text-[10px] text-emerald-600 uppercase font-bold">Completed</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-amber-50 border-amber-100">
                                        <div className="text-2xl font-bold text-amber-700">{stats.pendingVisits}</div>
                                        <div className="text-[10px] text-amber-600 uppercase font-bold">Pending</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-red-50 border-red-100">
                                        <div className="text-2xl font-bold text-red-700">{stats.cancelledVisits}</div>
                                        <div className="text-[10px] text-red-600 uppercase font-bold">Cancelled</div>
                                    </div>
                                </div>
                            </section>

                            {/* Doctor Performance */}
                            <section>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                                    <Stethoscope className="h-4 w-4" /> Practitioner Contribution
                                </h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead>Doctor Name</TableHead>
                                                <TableHead className="text-center">Visits Seen</TableHead>
                                                <TableHead className="text-right">Revenue Generated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {doctorStats.map((doc, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium text-slate-800">{doc.name}</TableCell>
                                                    <TableCell className="text-center font-semibold">{doc.visits}</TableCell>
                                                    <TableCell className="text-right font-bold text-blue-700">KES {doc.revenue.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>

                            {/* Top Services */}
                            <section>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                                    <BarChart className="h-4 w-4" /> Top Revenue Services
                                </h4>
                                <div className="space-y-4">
                                    {serviceUsage.slice(0, 5).map((svc, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5">
                                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                                <span>{svc.service_name}</span>
                                                <span className="text-slate-400 font-medium">{svc.count} Visits</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                                                <div
                                                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${(svc.count / (stats.totalVisits || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={() => setIsReportOpen(false)}>Close Summary</Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6">
                                <FileText className="mr-2 h-4 w-4" />
                                Export Detailed PDF
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pb-12">
                <Card className="shadow-sm border-blue-100 flex flex-col h-full overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                            <Stethoscope className="h-5 w-5 text-purple-600" /> Top Services Used
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-grow">
                        {serviceUsage.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-8">No service usage data available.</p>
                        ) : (
                            <div className="space-y-3">
                                {serviceUsage.slice(0, 8).map((service, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800">{service.service_name}</span>
                                            <span className="text-xs text-slate-400 font-medium">{service.count} Successful Visits</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="font-bold text-slate-800">{((service.count / (stats.totalVisits || 1)) * 100).toFixed(0)}%</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Volume</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-blue-100 flex flex-col h-full overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                            <Users className="h-5 w-5 text-blue-600" /> Most Active Members
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-grow">
                        {memberActivity.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-8">No member activity data available.</p>
                        ) : (
                            <div className="space-y-3">
                                {memberActivity.slice(0, 8).map((member, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-blue-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm uppercase shadow-sm">
                                                {member.member_name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{member.member_name}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: {member.member_number}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-slate-900 leading-tight">{member.total_visits} Visits</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatSimpleCard({ title, value, icon: Icon, color, subtitle }: any) {
    const colors: any = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        purple: "text-purple-600 bg-purple-50 border-purple-100",
        orange: "text-orange-600 bg-orange-50 border-orange-100",
    };

    return (
        <Card className="shadow-none border-blue-50 overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg ${colors[color]}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] opacity-70">Monthly</Badge>
                </div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">{title}</h3>
                <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
                {subtitle && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{subtitle}</p>}
            </CardContent>
        </Card>
    );
}
