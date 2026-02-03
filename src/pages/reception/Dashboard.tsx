import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Clock, CheckCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";

export default function ReceptionDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        todayVisits: 0,
        activeVisits: 0,
        pendingBills: 0
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        // Placeholder for fetching stats
        // We can query 'visits' table filter by today and status
        const today = new Date().toISOString().split('T')[0];

        // @ts-ignore
        const { count: todayCount } = await supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', today);

        // @ts-ignore
        const { count: activeCount } = await supabase.from('visits').select('*', { count: 'exact', head: true }).neq('status', 'completed').gte('created_at', today);

        // @ts-ignore
        const { count: billCount } = await supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'billed');

        setStats({
            todayVisits: todayCount || 0,
            activeVisits: activeCount || 0,
            pendingBills: billCount || 0
        });
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
                        <CardTitle className="text-sm font-medium">Active In-Clinic</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeVisits}</div>
                        <p className="text-xs text-muted-foreground">Currently being attended</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Billing</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingBills}</div>
                        <p className="text-xs text-muted-foreground">Waiting for payment/clearance</p>
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
                        <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => navigate("/reception/register-visit")}>
                            <UserPlus className="h-6 w-6" />
                            Walk-in Registration
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
