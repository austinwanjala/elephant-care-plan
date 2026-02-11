import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from "recharts";
import { startOfWeek, endOfWeek, format, subDays, eachDayOfInterval } from "date-fns";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

const AppointmentAnalytics = () => {
    // 1. Fetch appointments for analysis (last 30 days usually adequate for overview)
    const { data: appointments, isLoading } = useQuery({
        queryKey: ["director_analytics_appointments"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            // Get director's branch
            const { data: staff } = await supabase
                .from("staff")
                .select("branch_id")
                .eq("user_id", user.id)
                .single();

            if (!staff?.branch_id) return [];

            const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");

            const { data, error } = await supabase
                .from("appointments")
                .select(`
                    id, 
                    status, 
                    appointment_date, 
                    doctor:staff(full_name),
                    service:services(name)
                `)
                .eq("branch_id", staff.branch_id)
                .gte("appointment_date", startDate);

            if (error) throw error;
            return data;
        }
    });

    const analyticsData = useMemo(() => {
        if (!appointments) return null;

        // A. Status Distribution
        const statusCounts: Record<string, number> = {};
        appointments.forEach(a => {
            statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        });
        const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

        // B. Doctor Workload
        const doctorCounts: Record<string, number> = {};
        appointments.forEach(a => {
            const docName = a.doctor?.full_name || "Unknown";
            doctorCounts[docName] = (doctorCounts[docName] || 0) + 1;
        });
        const doctorData = Object.entries(doctorCounts)
            .map(([name, appointments]) => ({ name, appointments }))
            .sort((a, b) => b.appointments - a.appointments);

        // C. Daily Volume (Last 7 Days)
        const last7Days = eachDayOfInterval({
            start: subDays(new Date(), 6),
            end: new Date()
        });

        const dailyData = last7Days.map(date => {
            const dateStr = format(date, "yyyy-MM-dd");
            const count = appointments.filter(a => a.appointment_date === dateStr).length;
            return {
                date: format(date, "MMM dd"),
                appointments: count
            };
        });

        return { statusData, doctorData, dailyData };
    }, [appointments]);

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (!analyticsData || appointments?.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No appointment data available for analytics.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* 1. Status Distribution */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Appointment Outcomes</CardTitle>
                        <CardDescription>Status distribution (Last 30 Days)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analyticsData.statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {analyticsData.statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 2. Daily Volume */}
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Daily Appointments</CardTitle>
                        <CardDescription>Volume over the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analyticsData.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="appointments" stroke="#8884d8" activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 3. Doctor Workload */}
                <Card className="col-span-1 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Doctor Workload</CardTitle>
                        <CardDescription>Appointments assigned per doctor (Last 30 Days)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.doctorData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="appointments" fill="#82ca9d" name="Appointments" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AppointmentAnalytics;
