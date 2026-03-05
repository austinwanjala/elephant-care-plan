import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Clock, CheckCircle, Search, Receipt, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ReceptionDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        todayVisits: 0,
        withDoctorVisits: 0,
        pendingBills: 0
    });
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

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
            console.error("Receptionist's branch not found or error:", staffError);
            setLoading(false);
            return;
        }

        const branchId = staffData.branch_id;

        // Fetch Counts
        const { count: todayCount } = await supabase.from('visits').select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .gte('created_at', today);

        const { count: withDoctorCount } = await supabase.from('visits').select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .eq('status', 'with_doctor')
            .gte('created_at', today);

        const { count: billedCount } = await supabase.from('visits').select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .eq('status', 'billed')
            .gte('created_at', today);

        // Fetch actual visits list
        const { data: visitsList } = await (supabase as any)
            .from('visits')
            .select('*, members(full_name, member_number), dependants(full_name), doctor:assigned_doctor_id(full_name)')
            .eq('branch_id', branchId)
            .gte('created_at', today)
            .order('created_at', { ascending: false })
            .limit(10);

        setStats({
            todayVisits: todayCount || 0,
            withDoctorVisits: withDoctorCount || 0,
            pendingBills: billedCount || 0
        });
        setVisits(visitsList || []);
        setLoading(false);
    };

    return (
        <div className="dashboard-luxury-bg p-4 md:p-8 min-h-screen">
            <div className="soft-glow-emerald top-[-5%] left-[-5%]" />
            <div className="soft-glow-blue bottom-[-5%] right-[-5%]" />

            <div className="flex flex-col gap-8 relative z-10 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900">Reception Dashboard</h1>
                        <p className="text-slate-500 mt-1">Ready to assist our patients with care and efficiency.</p>
                    </div>
                    <Button onClick={() => navigate("/reception/register-visit")} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-200/50 rounded-2xl px-8 h-12 font-black transition-all hover:scale-105 active:scale-95">
                        <UserPlus className="h-5 w-5" /> Register New Visit
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="card-premium-amber group h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 header-gradient-amber border-b border-amber-100/50">
                            <CardTitle className="text-sm font-black text-amber-800 uppercase tracking-widest leading-none">Today's Visits</CardTitle>
                            <div className="p-2 icon-glow-amber rounded-xl group-hover:scale-110 transition-transform duration-300">
                                <Users className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-4xl font-black text-amber-700">{stats.todayVisits}</div>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter">Total network participants today</p>
                        </CardContent>
                    </Card>
                    <Card className="card-premium-blue group h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 header-gradient-blue border-b border-blue-100/50">
                            <CardTitle className="text-sm font-black text-blue-800 uppercase tracking-widest leading-none">With Doctor</CardTitle>
                            <div className="p-2 icon-glow-blue rounded-xl group-hover:scale-110 transition-transform duration-300">
                                <Clock className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-4xl font-black text-blue-700">{stats.withDoctorVisits}</div>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter">Currently in clinical session</p>
                        </CardContent>
                    </Card>
                    <Card className="card-premium-emerald group h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 header-gradient-emerald border-b border-emerald-100/50">
                            <CardTitle className="text-sm font-black text-emerald-800 uppercase tracking-widest leading-none">Pending Billing</CardTitle>
                            <div className="p-2 icon-glow-emerald rounded-xl group-hover:scale-110 transition-transform duration-300">
                                <Receipt className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-4xl font-black text-emerald-700">{stats.pendingBills}</div>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter">Awaiting financial clearance</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-7">
                    <Card className="col-span-full xl:col-span-2 card-premium">
                        <CardHeader className="bg-slate-50/50 border-b pb-4">
                            <CardTitle className="text-lg font-black text-slate-900 font-serif">Front-Office Ops</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-5 p-8">
                            <Button variant="outline" className="h-28 flex flex-col items-start gap-2 p-6 rounded-[2rem] border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group shadow-sm bg-white" onClick={() => navigate("/reception/search")}>
                                <div className="flex items-center gap-3 font-black text-slate-800 group-hover:text-emerald-600 transition-colors">
                                    <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-emerald-100 transition-colors">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm">Search Member</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-11">Register Clinical Visit</span>
                            </Button>
                            <Button variant="outline" className="h-28 flex flex-col items-start gap-2 p-6 rounded-[2rem] border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all group shadow-sm bg-white" onClick={() => navigate("/reception/billing")}>
                                <div className="flex items-center gap-3 font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                                    <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-blue-100 transition-colors">
                                        <Receipt className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm">Billing Suite</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-11">Invoicing & Clearance</span>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="col-span-full xl:col-span-5 card-premium">
                        <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-3 text-2xl font-black text-slate-900 font-serif">
                                <div className="p-2.5 rounded-2xl bg-primary/10">
                                    <Clock className="h-6 w-6 text-primary" />
                                </div>
                                Recent Activity
                            </CardTitle>
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black text-[10px] uppercase px-4 h-7 rounded-full animate-pulse shadow-sm">Live Feed</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/30">
                                        <TableRow className="hover:bg-transparent border-b-slate-100">
                                            <TableHead className="font-bold text-slate-600 pl-6">Time</TableHead>
                                            <TableHead className="font-bold text-slate-600">Patient Detail</TableHead>
                                            <TableHead className="font-bold text-slate-600">Clinical Allocation</TableHead>
                                            <TableHead className="font-bold text-slate-600 pr-6 text-right">Progress</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <Clock className="animate-spin h-8 w-8 text-primary opacity-20" />
                                                        <span className="text-slate-400 font-bold text-xs uppercase animate-pulse">Synchronizing records...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : visits.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic">
                                                    No clinical registrations recorded yet today.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            visits.map((visit) => (
                                                <TableRow key={visit.id} className="group hover:bg-slate-50/50 transition-colors border-b-slate-50">
                                                    <TableCell className="font-black text-slate-400 text-xs pl-6">
                                                        {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:bg-primary group-hover:text-white transition-all">
                                                                {(visit.dependants?.full_name || visit.members?.full_name)?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-800 text-sm">
                                                                    {visit.dependants?.full_name || visit.members?.full_name}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    ID: {visit.members?.member_number}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">
                                                                {visit.doctor?.full_name ? `Dr. ${visit.doctor.full_name}` : "Pending Allocation"}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 italic font-medium">Dental Unit</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right">
                                                        <Badge variant="outline" className={cn(
                                                            "capitalize text-[9px] font-black h-5 px-2 rounded-lg",
                                                            visit.status === 'registered' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                                visit.status === 'with_doctor' ? "bg-orange-50 text-orange-600 border-orange-100 animate-pulse" :
                                                                    visit.status === 'billed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                                        "bg-slate-100 text-slate-500 border-slate-200"
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}