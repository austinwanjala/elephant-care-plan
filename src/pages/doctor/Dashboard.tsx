import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, ClipboardList, History, LayoutDashboard, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";

export default function DoctorDashboard() {
    const [stats, setStats] = useState({ waiting: 0, inProgress: 0 });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staffData } = await supabase
            .from("staff")
            .select("id, branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!staffData) return;

        const today = new Date().toISOString().split('T')[0];

        const { data: visits } = await supabase
            .from("visits")
            .select("status")
            .eq('branch_id', staffData.branch_id)
            .or(`and(status.eq.registered,created_at.gte.${today}),and(status.eq.with_doctor,doctor_id.eq.${staffData.id})`);

        if (visits) {
            setStats({
                waiting: visits.filter(v => v.status === 'registered').length,
                inProgress: visits.filter(v => v.status === 'with_doctor').length
            });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
                <p className="text-muted-foreground">Welcome back. Here is your overview for today.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/doctor/queue")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Waiting Room</CardTitle>
                        <Users className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-500">{stats.waiting}</div>
                        <p className="text-xs text-muted-foreground">Patients waiting for consultation</p>
                        <Button variant="link" className="px-0 mt-2 h-auto text-xs">View Queue <ArrowRight className="ml-1 h-3 w-3" /></Button>
                    </CardContent>
                </Card>
                <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate("/doctor/queue")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        <ClipboardList className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">{stats.inProgress}</div>
                        <p className="text-xs text-muted-foreground">Active consultations</p>
                        <Button variant="link" className="px-0 mt-2 h-auto text-xs">Continue Sessions <ArrowRight className="ml-1 h-3 w-3" /></Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button variant="outline" className="h-20 flex flex-col gap-1" onClick={() => navigate("/doctor/queue")}>
                            <ClipboardList className="h-5 w-5" />
                            Open Today's Queue
                        </Button>
                        <Button variant="outline" className="h-20 flex flex-col gap-1" onClick={() => navigate("/doctor/history")}>
                            <History className="h-5 w-5" />
                            Search Patient History
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}