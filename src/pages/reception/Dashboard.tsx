import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Clock, CheckCircle, Search, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ReceptionDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        todayVisits: 0,
        withDoctorVisits: 0,
        pendingBills: 0
    });
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

        // Get receptionist's branch_id
        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData?.branch_id) {
            // Handle error or no branch assigned
            console.error("Receptionist's branch not found or error:", staffError);
            setLoading(false);
            return;
        }

        const branchId = staffData.branch_id;

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

        setStats({
            todayVisits: todayCount || 0,
            withDoctorVisits: withDoctorCount || 0,
            pendingBills: billedCount || 0
        });
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Reception Dashboard</h1>
                <Button onClick={() => navigate("/reception/register-visit")}>
                    <UserPlus className="mr-2 h-4 w-4" /> Register New Visit
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayVisits}</div>
                        <p className="text-xs text-muted-foreground">Total walk-ins today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">With Doctor</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.withDoctorVisits}</div>
                        <p className="text-xs text-muted-foreground">Currently being attended</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Billing</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingBills}</div>
                        <p className="text-xs text-muted-foreground">Waiting for finalization</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => navigate("/reception/search")}>
                            <Search className="h-6 w-6" />
                            Search Member / Check Balance
                        </Button>
                        <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => navigate("/reception/billing")}>
                            <Receipt className="h-6 w-6" />
                            Finalize Bills
                        </Button>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground">
                            No recent activity to show.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}