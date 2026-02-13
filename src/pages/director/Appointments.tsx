import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, User, MapPin, Building2, BarChart2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppointmentAnalytics from "@/components/director/AppointmentAnalytics";

const DirectorAppointments = () => {
    const [activeTab, setActiveTab] = useState("upcoming");
    const [branchName, setBranchName] = useState<string | null>(null);

    const { data: appointments, isLoading } = useQuery({
        queryKey: ["director_appointments", activeTab],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data: staff } = await supabase
                .from("staff")
                .select("branch_id, branches(name)")
                .eq("user_id", user.id)
                .single();

            if (!staff?.branch_id) {
                toast.error("No branch assigned to this director account.");
                return [];
            }

            setBranchName(staff.branches?.name || "Unknown Branch");

            let query = supabase
                .from("appointments")
                .select(`
                    id, created_at, status, appointment_date, start_time,
                    members (full_name, phone),
                    dependants (full_name),
                    staff (full_name),
                    branches (name)
                `)
                .eq("branch_id", staff.branch_id);

            // Filter: Only show CONFIRMED (approved) or completed/other final statuses.
            // Excluding 'pending' and 'cancelled' from "Upcoming" usually.
            // User asked: "only show the approved appointments"

            if (activeTab === "upcoming") {
                // Show future confirmed appointments
                const today = new Date().toISOString().split('T')[0];
                query = query
                    .eq("status", "confirmed")
                    .gte("appointment_date", today)
                    .order("appointment_date", { ascending: true })
                    .order("start_time", { ascending: true });
            } else if (activeTab === "history") {
                // Show past or completed
                // or just all non-pending? Let's stick to standard history: completed, no-show, etc.
                query = query
                    .in("status", ["completed", "checked_in", "no_show", "cancelled", "confirmed"]) // Include confirmed if they want to search? mostly past.
                    // Let's make history "Past" mainly? Or "All processed"? 
                    // Let's make it "All Appointments" excluding pending, ordered by date desc.
                    .neq("status", "pending")
                    .order("appointment_date", { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching appointments:", error);
                throw error;
            }
            return data;
        }
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "confirmed": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Confirmed</Badge>;
            case "completed": return <Badge className="bg-blue-600">Completed</Badge>;
            case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
            case "checked_in": return <Badge className="bg-indigo-500">Checked In</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Appointments</h2>
                    <p className="text-muted-foreground">View scheduled appointments for your branch.</p>
                </div>
                {branchName && <Badge variant="outline" className="text-base px-3 py-1"><Building2 className="w-4 h-4 mr-2" /> {branchName}</Badge>}
            </div>

            <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
                    <TabsTrigger value="upcoming" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Upcoming
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> History
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" /> Analytics
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="mt-4">
                    <AppointmentAnalytics />
                </TabsContent>

                {activeTab !== 'analytics' && (
                    <Card className="card-elevated border-none shadow-md">
                        <CardHeader className="bg-muted/30 pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                {activeTab === "upcoming" ? <Calendar className="h-5 w-5 text-blue-600" /> : <CheckCircle2 className="h-5 w-5 text-gray-600" />}
                                {activeTab === "upcoming" ? "Upcoming Confirmed Appointments" : "Appointment History"}
                            </CardTitle>
                            <CardDescription>
                                {activeTab === "upcoming"
                                    ? `Scheduled visits for ${branchName || "your branch"}.`
                                    : `Past and processed appointment records.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
                            ) : !appointments || appointments.length === 0 ? (
                                <div className="text-center p-12 text-muted-foreground">
                                    <p className="text-lg font-medium">No appointments found</p>
                                    <p className="text-sm">There are no {activeTab} appointments to display.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {appointments.map((appt: any) => {
                                        const patientName = appt.dependants
                                            ? `${appt.dependants.full_name} (Dep)`
                                            : `${appt.members.full_name}`;
                                        const phone = appt.members?.phone || "N/A";

                                        return (
                                            <div key={appt.id} className="flex flex-col md:flex-row items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex gap-4 w-full md:w-auto items-start">
                                                    <div className="flex-shrink-0 text-center w-20 bg-blue-50/50 rounded-lg p-2 text-blue-700 border border-blue-100">
                                                        <div className="font-bold text-lg leading-none">{format(new Date(appt.appointment_date), "dd")}</div>
                                                        <div className="text-xs uppercase font-semibold mt-1">{format(new Date(appt.appointment_date), "MMM")}</div>
                                                        <div className="text-xs mt-1 pt-1 border-t border-blue-200">{appt.start_time.slice(0, 5)}</div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-semibold text-lg text-slate-900">{patientName}</h4>
                                                            {getStatusBadge(appt.status)}
                                                        </div>
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                                            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Dr. {appt.staff?.full_name}</span>
                                                            {phone && <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-100 rounded-full">{phone}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* No actions for Director anymore, just view */}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </Tabs>
        </div>
    );
};

export default DirectorAppointments;
