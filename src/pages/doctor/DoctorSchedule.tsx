import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, Clock, User, Phone } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const DoctorSchedule = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [doctorId, setDoctorId] = useState<string | null>(null);

    // Fetch current doctor's ID
    useEffect(() => {
        const getDoctorId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase.from("staff").select("id").eq("user_id", user.id).maybeSingle();
            if (data) setDoctorId(data.id);
        };
        getDoctorId();
    }, []);

    const { data: appointments, isLoading } = useQuery({
        queryKey: ["doctor_appointments", doctorId, date],
        enabled: !!doctorId && !!date,
        queryFn: async () => {
            const formattedDate = format(date!, "yyyy-MM-dd");
            const { data, error } = await supabase
                .from("appointments")
                .select(`
                    *,
                    members (first_name, last_name, phone_number, membership_number, gender),
                    dependants (first_name, last_name, gender)
                `)
                .eq("doctor_id", doctorId)
                .eq("appointment_date", formattedDate)
                .neq("status", "pending") // Doctor only sees approved (confirmed) or processed appointments
                .order("start_time", { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return "bg-green-100 text-green-800";
            case "pending": return "bg-yellow-100 text-yellow-800";
            case "checked_in": return "bg-blue-100 text-blue-800";
            case "completed": return "bg-gray-100 text-gray-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">My Schedule</h2>
                    <p className="text-muted-foreground">Manage your appointments and consultations.</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-80 shrink-0 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Date</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                className="rounded-md border shadow-sm w-full"
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="flex-1 min-w-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5" />
                                Appointments for {date ? format(date, "MMMM do, yyyy") : "Select a date"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                            ) : !appointments || appointments.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">
                                    No appointments scheduled for this date.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {appointments.map((appt: any) => {
                                        const patientName = appt.dependants
                                            ? `${appt.dependants.first_name} ${appt.dependants.last_name} (Dep)`
                                            : `${appt.members.first_name} ${appt.members.last_name}`;

                                        const gender = appt.dependants ? appt.dependants.gender : appt.members.gender;

                                        return (
                                            <div key={appt.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                                <div className="flex items-start gap-4 mb-4 md:mb-0">
                                                    <Avatar className="h-12 w-12">
                                                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${patientName}`} />
                                                        <AvatarFallback>{patientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h4 className="font-semibold text-lg">{patientName}</h4>
                                                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {appt.start_time.slice(0, 5)} - {appt.end_time.slice(0, 5)}
                                                            </div>
                                                            <Badge variant="outline" className={getStatusColor(appt.status)}>
                                                                {appt.status.replace('_', ' ')}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                            <Phone className="h-3 w-3" /> {appt.members.phone_number}
                                                            <span className="mx-1">•</span>
                                                            <User className="h-3 w-3" /> {gender}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 w-full md:w-auto">
                                                    {appt.status === 'checked_in' && (
                                                        <Button size="sm" onClick={() => navigate(`/doctor/consultation/${appt.visit_id}`)}>
                                                            Start Consultation
                                                        </Button>
                                                    )}
                                                    {appt.status === 'confirmed' && (
                                                        <Button variant="outline" size="sm" disabled>
                                                            Awaiting Check-in
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DoctorSchedule;
