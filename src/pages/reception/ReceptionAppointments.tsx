import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, User, CheckCircle2, RefreshCcw, Search, Filter, Fingerprint } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { BiometricCapture } from "@/components/BiometricCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const ReceptionAppointments = () => {
    const queryClient = useQueryClient();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [branchId, setBranchId] = useState<string | null>(null);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [checkInAppointmentId, setCheckInAppointmentId] = useState<string | null>(null);
    const [checkInMemberId, setCheckInMemberId] = useState<string | null>(null);
    const [checkInBiometricsId, setCheckInBiometricsId] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");

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

    // Fetch Doctors for Filter
    const { data: doctors } = useQuery({
        queryKey: ["branch_doctors", branchId],
        enabled: !!branchId,
        queryFn: async () => {
            const { data } = await supabase
                .from("staff")
                .select("id, full_name")
                .eq("branch_id", branchId)
                // Filter by role manually or assume staff in branch list are relevant. 
                // ideally join user_roles but simple is fine for filter list.
                .order("full_name");
            return data || [];
        }
    });

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
                    members (id, full_name, phone_number, biometric_data),
                    dependants (full_name),
                    doctor:staff(full_name)
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
            case "confirmed": return "bg-green-100 text-green-800 border-green-200";
            case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "checked_in": return "bg-blue-100 text-blue-800 border-blue-200";
            case "completed": return "bg-gray-100 text-gray-800 border-gray-200";
            case "cancelled": return "bg-red-100 text-red-800 border-red-200";
            case "no_show": return "bg-slate-100 text-slate-800 border-slate-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    // Filter Logic
    const filteredAppointments = appointments?.filter((appt: any) => {
        // Patient Name Search
        const patientName = appt.dependants
            ? `${appt.dependants.full_name}`
            : `${appt.members.full_name}`;

        const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (appt.members.phone_number && appt.members.phone_number.includes(searchQuery));

        const matchesDoctor = selectedDoctorId === "all" || appt.doctor_id === selectedDoctorId;

        return matchesSearch && matchesDoctor;
    }) || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Appointments</h2>
                    <p className="text-muted-foreground">Manage daily appointments and check-ins.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["reception_appointments"] })}>
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar: Date Picker */}
                <div className="w-full lg:w-80 shrink-0 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Select Date</CardTitle>
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

                    {/* Stats Card (Optional) */}
                    <Card>
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-bold">{filteredAppointments.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Pending Check-in:</span>
                                <span className="font-bold text-orange-600">
                                    {filteredAppointments.filter((a: any) => a.status === 'confirmed' || a.status === 'pending').length}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content: Appointments Table */}
                <div className="flex-1 space-y-4 min-w-0">
                    {/* Filters Bar */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by patient name or phone..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="All Doctors" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Doctors</SelectItem>
                                {doctors?.map(doc => (
                                    <SelectItem key={doc.id} value={doc.id}>{doc.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                Schedule for {date ? format(date, "MMMM do, yyyy") : "Selected Date"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
                            ) : filteredAppointments.length === 0 ? (
                                <div className="text-center p-12 text-muted-foreground">
                                    No appointments found matching your criteria.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Time</TableHead>
                                            <TableHead>Patient</TableHead>
                                            <TableHead>Doctor</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredAppointments.map((appt: any) => {
                                            const patientName = appt.dependants
                                                ? `${appt.dependants.full_name}`
                                                : `${appt.members.full_name}`;
                                            const isDependant = !!appt.dependants;

                                            return (
                                                <TableRow key={appt.id}>
                                                    <TableCell className="font-medium align-top">
                                                        <div className="flex flex-col">
                                                            <span className="text-base">{appt.start_time.slice(0, 5)}</span>
                                                            <span className="text-xs text-muted-foreground">{appt.end_time.slice(0, 5)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{patientName}</span>
                                                            {isDependant && <Badge variant="secondary" className="w-fit text-[10px] py-0 h-4 mt-1">Dependant</Badge>}
                                                            <span className="text-xs text-muted-foreground mt-1">{appt.members.phone_number}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <span>Dr. {appt.doctor?.full_name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <Badge variant="outline" className={getStatusColor(appt.status)}>
                                                            {appt.status.replace('_', ' ')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right align-top">
                                                        {appt.status === 'confirmed' && (
                                                            <Button size="sm" onClick={() => handleInitialCheckIn(appt)}>
                                                                <CheckCircle2 className="mr-2 h-4 w-4" /> Check In
                                                            </Button>
                                                        )}
                                                        {appt.status === 'pending' && (
                                                            <Button size="sm" variant="outline" disabled>
                                                                Pending Approval
                                                            </Button>
                                                        )}
                                                        {appt.status === 'checked_in' && (
                                                            <Button size="sm" variant="secondary" disabled>
                                                                Checked In
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
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
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm border border-blue-100">
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
                                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm flex items-center gap-2 border border-yellow-100">
                                    <Fingerprint className="h-4 w-4" /> No biometric data found for this member.
                                </div>
                                <div className="text-sm text-muted-foreground p-2">
                                    Please verify the patient's ID (National ID, Passport) manually.
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
