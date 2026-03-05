import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Clock, CheckCircle, Search, Receipt, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Reception Dashboard</h1>
                <Button onClick={() => navigate("/reception/register-visit")} className="gap-2">
                    <UserPlus className="h-4 w-4" /> Register New Visit
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-orange-50/50 border-orange-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
                        <Users className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{stats.todayVisits}</div>
                        <p className="text-xs text-muted-foreground">Total walk-ins today</p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">With Doctor</CardTitle>
                        <Clock className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{stats.withDoctorVisits}</div>
                        <p className="text-xs text-muted-foreground">Currently being attended</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50/50 border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Billing</CardTitle>
                        <Receipt className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700">{stats.pendingBills}</div>
                        <p className="text-xs text-muted-foreground">Waiting for finalization</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-full xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button variant="outline" className="h-20 flex flex-col items-start gap-1 p-4" onClick={() => navigate("/reception/search")}>
                            <div className="flex items-center gap-2 font-bold">
                                <Search className="h-4 w-4 text-primary" /> Search Member
                            </div>
                            <span className="text-[10px] text-muted-foreground">Check balance & register visit</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex flex-col items-start gap-1 p-4" onClick={() => navigate("/reception/billing")}>
                            <div className="flex items-center gap-2 font-bold">
                                <Receipt className="h-4 w-4 text-primary" /> Finalize Bills
                            </div>
                            <span className="text-[10px] text-muted-foreground">Process invoices & payments</span>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="col-span-full xl:col-span-5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Today's Registered Patients
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-4">
                                                <div className="flex justify-center"><Clock className="animate-spin h-5 w-5" /></div>
                                            </TableCell>
                                        </TableRow>
                                    ) : visits.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                                No visits recorded for today yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        visits.map((visit) => (
                                            <TableRow key={visit.id}>
                                                <TableCell className="text-xs font-medium">
                                                    {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold text-sm">
                                                        {visit.dependants?.full_name || visit.members?.full_name}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        #{visit.members?.member_number}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {visit.doctor?.full_name ? `Dr. ${visit.doctor.full_name}` : "Unassigned"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize text-[10px] h-5">
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
    );
}