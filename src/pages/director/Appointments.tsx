import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Calendar, User, Clock, MapPin, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DirectorAppointments = () => {
    const queryClient = useQueryClient();
    const [actioningId, setActioningId] = useState<string | null>(null);

    // Fetch Pending Appointments (Global or Branch specific? "Branch Director" implies Branch)
    // We first need to know the director's branch.
    // Assuming Director is a Staff member with role 'director' or similar, linked to a branch.

    const [branchName, setBranchName] = useState<string | null>(null);

    // Fetch Pending Appointments
    const { data: appointments, isLoading } = useQuery({
        queryKey: ["director_pending_appointments"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            // Get director's branch
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

            const { data, error } = await supabase
                .from("appointments")
                .select(`
                    id, created_at, status, appointment_date, start_time,
                    members (full_name, phone),
                    dependants (full_name),
                    staff (full_name),
                    branches (name)
                `)
                .eq("branch_id", staff.branch_id)
                .in("status", ["pending"]) // Approval Queue
                .order("created_at", { ascending: true }); // Oldest first

            if (error) {
                console.error("Error fetching appointments:", error);
                throw error;
            }
            return data;
        }
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("appointments")
                .update({ status: 'confirmed' })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["director_pending_appointments"] });
            toast.success("Appointment approved.");
            setActioningId(null);
        },
        onError: () => {
            toast.error("Failed to approve.");
            setActioningId(null);
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("appointments")
                .update({ status: 'cancelled' })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["director_pending_appointments"] });
            toast.success("Appointment rejected.");
            setActioningId(null);
        },
        onError: () => {
            toast.error("Failed to reject.");
            setActioningId(null);
        }
    });

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setActioningId(id);
        if (action === 'approve') {
            approveMutation.mutate(id);
        } else {
            if (confirm("Reject this appointment?")) {
                rejectMutation.mutate(id);
            } else {
                setActioningId(null);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Appointment Approvals</h2>
                    <p className="text-muted-foreground">Review and approve pending appointment requests.</p>
                </div>
                {branchName && <Badge variant="outline" className="text-base px-3 py-1"><Building2 className="w-4 h-4 mr-2" /> {branchName}</Badge>}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        Pending Approvals
                    </CardTitle>
                    <CardDescription>
                        Appointments requiring your authorization for {branchName || "your branch"}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
                    ) : !appointments || appointments.length === 0 ? (
                        <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
                            No pending appointments found for {branchName}.
                            <br /><span className="text-xs">Ensure the appointment was booked for this specific branch.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {appointments.map((appt: any) => {
                                const patientName = appt.dependants
                                    ? `${appt.dependants.full_name} (Dep)`
                                    : `${appt.members.full_name}`;

                                return (
                                    <div key={appt.id} className="flex flex-col md:flex-row items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="flex gap-4 w-full md:w-auto">
                                            <div className="flex-shrink-0 text-center w-20 bg-primary/10 rounded p-2 text-primary">
                                                <div className="font-bold">{format(new Date(appt.appointment_date), "MMM d")}</div>
                                                <div className="text-xs">{appt.start_time.slice(0, 5)}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-lg">{patientName}</h4>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> Dr. {appt.staff?.full_name}</span>
                                                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {appt.branches?.name}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Request received: {format(new Date(appt.created_at), "MMM d, h:mm a")}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4 md:mt-0 w-full md:w-auto">
                                            <Button
                                                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                                                onClick={() => handleAction(appt.id, 'approve')}
                                                disabled={!!actioningId}
                                            >
                                                {actioningId === appt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Approve
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                className="flex-1 md:flex-none"
                                                onClick={() => handleAction(appt.id, 'reject')}
                                                disabled={!!actioningId}
                                            >
                                                {actioningId === appt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DirectorAppointments;
