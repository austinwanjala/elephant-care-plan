import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, ClipboardList, History, ArrowRight, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

        // Restriction: doctors only see visits assigned to them.
        const { data: visits } = await (supabase as any)
            .from("visits")
            .select("status")
            .eq('branch_id', staffData.branch_id)
            .eq('assigned_doctor_id', staffData.id)
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
        <div className="dashboard-luxury-bg p-4 md:p-8 min-h-screen">
            <div className="soft-glow-emerald top-[-5%] left-[-5%]" />
            <div className="soft-glow-blue bottom-[-5%] right-[-5%]" />

            <div className="flex flex-col gap-6 relative z-10 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900">Doctor Dashboard</h1>
                    <p className="text-slate-500 mt-1">Welcome back. Here is your overview for today.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="hover:border-primary transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl bg-white/80 backdrop-blur-sm rounded-3xl border-orange-100" onClick={() => navigate("/doctor/queue")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold text-slate-600">Waiting Room</CardTitle>
                            <div className="p-2 bg-orange-100 rounded-xl">
                                <Users className="h-5 w-5 text-orange-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-orange-600">{stats.waiting}</div>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Patients waiting for consultation</p>
                            <Button variant="link" className="px-0 mt-4 h-auto text-xs font-bold text-orange-700">View Queue <ArrowRight className="ml-1 h-3 w-3" /></Button>
                        </CardContent>
                    </Card>
                    <Card className="hover:border-primary transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl bg-white/80 backdrop-blur-sm rounded-3xl border-blue-100" onClick={() => navigate("/doctor/queue")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold text-slate-600">In Progress</CardTitle>
                            <div className="p-2 bg-blue-100 rounded-xl">
                                <ClipboardList className="h-5 w-5 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-blue-600">{stats.inProgress}</div>
                            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Active consultations</p>
                            <Button variant="link" className="px-0 mt-4 h-auto text-xs font-bold text-blue-700">Continue Sessions <ArrowRight className="ml-1 h-3 w-3" /></Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-1 mt-4">
                    <Card className="shadow-md bg-white/80 backdrop-blur-sm rounded-3xl border-slate-100 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b pb-4">
                            <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <Activity className="h-5 w-5 text-primary" />
                                Quick Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-3 p-6">
                            <Button variant="outline" className="h-28 flex flex-col gap-2 rounded-2xl text-slate-700 border-slate-200 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-sm group" onClick={() => navigate("/doctor/queue")}>
                                <ClipboardList className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                                <span className="font-bold">Open MY Queue</span>
                                <span className="text-[10px] text-slate-400 font-medium">Manage today's visits</span>
                            </Button>
                            <Button variant="outline" className="h-28 flex flex-col gap-2 rounded-2xl text-slate-700 border-slate-200 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-sm group" onClick={() => navigate("/doctor/schedule")}>
                                <History className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                                <span className="font-bold">Approved Schedule</span>
                                <span className="text-[10px] text-slate-400 font-medium">View future bookings</span>
                            </Button>
                            <Button variant="outline" className="h-28 flex flex-col gap-2 rounded-2xl text-slate-700 border-slate-200 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-sm group" onClick={() => navigate("/doctor/history")}>
                                <Users className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                                <span className="font-bold">Patient Records</span>
                                <span className="text-[10px] text-slate-400 font-medium">Historical clinical files</span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
