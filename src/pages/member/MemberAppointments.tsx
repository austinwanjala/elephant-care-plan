import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, MapPin, User, Plus } from "lucide-react";
import { format } from "date-fns";
import BookingWizard from "@/components/member/appointments/BookingWizard";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const MemberAppointments = () => {
    const queryClient = useQueryClient();
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const { data: appointments, isLoading } = useQuery({
        queryKey: ["member_appointments"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            // Get member ID (and dependants if generic query later, but usually we filter by user's member_id or dependants linked to it)
            // For now, let's fetch appointments where the member_id is associated with this user, OR dependants under this user.
            // Easiest is to fetch the Member record first.

            const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).single();
            if (!member) return [];

            const { data, error } = await supabase
                .from("appointments")
                .select(`
          *,
          doctor:staff(first_name, last_name),
          branch:branches(name),
          dependants(first_name, last_name)
        `)
                .eq("member_id", member.id) // This assumes appointments are linked to the principal member ID even for dependants? 
                // Or if appointment has a dependant_id, we should also check that.
                // RLS should handle visibility ideally.
                .order("appointment_date", { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return "bg-green-100 text-green-800";
            case "pending": return "bg-yellow-100 text-yellow-800";
            case "cancelled": return "bg-red-100 text-red-800";
            case "completed": return "bg-gray-100 text-gray-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const cancelMutation = useMutation({
        mutationFn: async (appointmentId: string) => {
            const { error } = await supabase
                .from("appointments")
                .update({ status: 'cancelled' })
                .eq("id", appointmentId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["member_appointments"] });
            toast.success("Appointment cancelled successfully");
        },
        onError: (err) => {
            toast.error("Failed to cancel: " + err.message);
        }
    });

    const upcomingAppointments = appointments?.filter(a => new Date(a.appointment_date) >= new Date().setHours(0, 0, 0, 0)) || [];
    const pastAppointments = appointments?.filter(a => new Date(a.appointment_date) < new Date().setHours(0, 0, 0, 0)) || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">My Appointments</h2>
                    <p className="text-muted-foreground">Manage your visits and bookings.</p>
                </div>
                <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Book Appointment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <BookingWizard onSuccess={() => setIsBookingOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="upcoming" className="w-full">
                <TabsList>
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="past">Past History</TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="mt-4">
                    {isLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
                    ) : upcomingAppointments.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium">No upcoming appointments</h3>
                                <p className="text-muted-foreground mb-4">You don't have any scheduled visits.</p>
                                <Button variant="outline" onClick={() => setIsBookingOpen(true)}>Book Now</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {upcomingAppointments.map((appt) => (
                                <Card key={appt.id}>
                                    <CardContent className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-lg">
                                                    {appt.dependants
                                                        ? `${appt.dependants.first_name} ${appt.dependants.last_name}`
                                                        : "Self"}
                                                </h4>
                                                <Badge variant="outline" className={getStatusColor(appt.status)}>
                                                    {appt.status}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-4 w-4" />
                                                    {format(new Date(appt.appointment_date), "MMM do, yyyy")}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-4 w-4" />
                                                    {appt.start_time.slice(0, 5)}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-4 w-4" />
                                                    {appt.branch.name}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <User className="h-4 w-4" />
                                                    Dr. {appt.doctor.first_name} {appt.doctor.last_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => toast.info("To reschedule, please cancel and book a new appointment.")}>Reschedule</Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => {
                                                    if (confirm("Are you sure you want to cancel this appointment?")) {
                                                        cancelMutation.mutate(appt.id);
                                                    }
                                                }}
                                                disabled={cancelMutation.isPending}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="past" className="mt-4">
                    {isLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
                    ) : pastAppointments.length === 0 ? (
                        <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
                            No past appointment history found.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {pastAppointments.map((appt) => (
                                <Card key={appt.id} className="bg-slate-50">
                                    <CardContent className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                        <div className="space-y-1 opacity-75">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold">
                                                    {appt.dependants
                                                        ? `${appt.dependants.first_name} ${appt.dependants.last_name}`
                                                        : "Self"}
                                                </h4>
                                                <Badge variant="outline" className="bg-gray-200">
                                                    {appt.status}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                <span>{format(new Date(appt.appointment_date), "MMM do, yyyy")}</span>
                                                <span>{appt.branch.name}</span>
                                                <span>Dr. {appt.doctor.first_name} {appt.doctor.last_name}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MemberAppointments;
