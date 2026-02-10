import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, Clock, User, CheckCircle2, Fingerprint, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { BiometricCapture } from "@/components/BiometricCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const ReceptionAppointments = () => {
    const queryClient = useQueryClient();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [branchId, setBranchId] = useState<string | null>(null);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [checkInAppointmentId, setCheckInAppointmentId] = useState<string | null>(null);
    const [checkInMemberId, setCheckInMemberId] = useState<string | null>(null);
    const [checkInBiometricsId, setCheckInBiometricsId] = useState<string | null>(null);

    // Fetch Receptionist Info
    useEffect(() => {
        const fetchStaffInfo = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase.from("staff").select("id, branch_id").eq("user_id", user.id).maybeSingle();
            if (data) {
                setBranchId(data.branch_id);
                setReceptionistId(data.id);
            }
        };
        fetchStaffInfo();
    }, []);

    // Fetch Appointments
    const { data: appointments, isLoading } = useQuery({
        queryKey: ["reception_appointments", branchId, date],
        enabled: !!branchId && !!date,
        queryFn: async () => {
            const formattedDate = format(date!, "yyyy-MM-dd");
            const { data, error } = await supabase
                .from("appointments")
                .select(`
                    *,
                    members (id, first_name, last_name, phone_number, biometric_data),
                    dependants (first_name, last_name),
                    doctor:staff(first_name, last_name)
                `)
                .eq("branch_id", branchId)
                .eq("appointment_date", formattedDate)
                .order("start_time", { ascending: true });

            if (error) throw error;
            return data;
        }
    });

    const checkInMutation = useMutation({
        mutationFn: async ({ appointmentId, verified }: { appointmentId: string, verified: boolean }) => {
            if (!verified) throw new Error("Biometric verification failed or skipped inappropriately.");

            const { error } = await supabase.rpc("check_in_appointment", {
                _appointment_id: appointmentId,
                _receptionist_id: receptionistId
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reception_appointments"] });
            toast.success("Patient checked in successfully. Visit created.");
            setCheckInAppointmentId(null);
        },
        onError: (err) => {
            toast.error("Check-in failed: " + err.message);
        }
    });

    const handleInitialCheckIn = (appt: any) => {
        setCheckInAppointmentId(appt.id);
        setCheckInMemberId(appt.members.id);
        // Biometrics are usually stored on the Principal Member
        // If appointment is for Dependant, verifying Principal is standard, or Dependant if they have data.
        // For simplicity, let's assume we verify the Principal Member for now as per schema logic seen in 'RegisterVisit'
        setCheckInBiometricsId(appt.members.biometric_data);
    };

    const handleBiometricVerification = (success: boolean) => {
        if (success && checkInAppointmentId) {
            checkInMutation.mutate({ appointmentId: checkInAppointmentId, verified: true });
        } else {
            toast.error("Biometric verification failed.");
        }
    };

    const handleManualCheckIn = () => {
        if (confirm("Confirm identity manually and proceed with check-in?")) {
            if (checkInAppointmentId) {
                checkInMutation.mutate({ appointmentId: checkInAppointmentId, verified: true });
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return "bg-green-100 text-green-800";
            case "pending": return "bg-yellow-100 text-yellow-800";
            case "checked_in": return "bg-blue-100 text-blue-800";
            case "completed": return "bg-gray-100 text-gray-800";
            case "cancelled": return "bg-red-100 text-red-800";
            case "no_show": return "bg-slate-100 text-slate-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Appointments</h2>
                    <p className="text-muted-foreground">Manage daily appointments and check-ins.</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["reception_appointments"] })}>
                    <RefreshCcw className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 xl:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Date</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                className="rounded-md border shadow-sm"
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8 xl:col-span-9">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5" />
                                Schedule for {date ? format(date, "MMMM do, yyyy") : "Selected Date"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                            ) : !appointments || appointments.length === 0 ? (
                                <div className="text-center p-12 text-muted-foreground">
                                    No appointments found for this date.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {appointments.map((appt: any) => {
                                        const patientName = appt.dependants
                                            ? `${appt.dependants.first_name} ${appt.dependants.last_name} (Dep)`
                                            : `${appt.members.first_name} ${appt.members.last_name}`;

                                        return (
                                            <div key={appt.id} className="flex flex-col md:flex-row items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                                                <div className="flex items-center gap-4 w-full md:w-auto mb-4 md:mb-0">
                                                    <div className="flex-shrink-0 text-center w-16 bg-slate-100 rounded p-2">
                                                        <div className="font-bold text-lg">{appt.start_time.slice(0, 5)}</div>
                                                        <div className="text-xs text-muted-foreground">to {appt.end_time.slice(0, 5)}</div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-lg">{patientName}</h4>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <User className="h-3 w-3" /> Dr. {appt.doctor.first_name} {appt.doctor.last_name}
                                                        </div>
                                                        <div className="flex gap-2 mt-1">
                                                            <Badge variant="outline" className={getStatusColor(appt.status)}>
                                                                {appt.status.replace('_', ' ')}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    {appt.status === 'confirmed' || appt.status === 'pending' ? (
                                                        <Button onClick={() => handleInitialCheckIn(appt)}>
                                                            <CheckCircle2 className="mr-2 h-4 w-4" /> Check In
                                                        </Button>
                                                    ) : (
                                                        <Button variant="outline" disabled>
                                                            {appt.status === 'checked_in' ? 'Checked In' : 'View Details'}
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

            {/* Check In Dialog */}
            <Dialog open={!!checkInAppointmentId} onOpenChange={(open) => !open && setCheckInAppointmentId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Patient Check-In</DialogTitle>
                        <DialogDescription>Verify identity to proceed with check-in.</DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {checkInBiometricsId ? (
                            <div className="space-y-4">
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
                                    Biometric data record found. Please ask member to scan fingerprint.
                                </div>
                                <BiometricCapture
                                    mode="verify"
                                    userId={checkInMemberId!}
                                    credentialId={checkInBiometricsId}
                                    onVerificationComplete={handleBiometricVerification}
                                />
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">Or</span>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" onClick={handleManualCheckIn}>
                                    Manual Override (ID Check)
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm flex items-center gap-2">
                                    <Fingerprint className="h-4 w-4" /> No biometric data found for this member.
                                </div>
                                <Button className="w-full" onClick={handleManualCheckIn}>
                                    Verify ID & Check In Manually
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ReceptionAppointments;
