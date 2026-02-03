import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, ClipboardList, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function DoctorDashboard() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [doctorBranchId, setDoctorBranchId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDoctorInfoAndVisits();
    }, []);

    const fetchDoctorInfoAndVisits = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("id, branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData?.id || !staffData?.branch_id) {
            toast({ title: "Error", description: "Could not retrieve doctor profile or branch.", variant: "destructive" });
            setLoading(false);
            return;
        }

        setDoctorId(staffData.id);
        setDoctorBranchId(staffData.branch_id);

        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from("visits")
            .select("*, members(full_name, member_number, age)") // Removed 'gender'
            .eq('branch_id', staffData.branch_id) // Filter by doctor's branch
            .or('status.eq.registered,status.eq.with_doctor') // Only show registered or with_doctor
            .gte('created_at', today)
            .order('created_at', { ascending: true });

        if (error) {
            toast({ title: "Error fetching visits", description: error.message, variant: "destructive" });
        } else {
            setVisits(data || []);
        }
        setLoading(false);
    };

    const handleStartConsultation = async (visitId: string, currentStatus: string) => {
        if (currentStatus === 'registered') {
            // Update visit status to 'with_doctor'
            const { error } = await supabase
                .from("visits")
                .update({ status: 'with_doctor', doctor_id: doctorId })
                .eq("id", visitId);

            if (error) {
                toast({ title: "Error starting consultation", description: error.message, variant: "destructive" });
                return;
            }
        }
        navigate(`/doctor/consultation/${visitId}`);
    };

    const waitingCount = visits.filter(v => v.status === 'registered').length;
    const inProgressCount = visits.filter(v => v.status === 'with_doctor').length;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
                    <p className="text-muted-foreground">Manage your daily consultations.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Waiting Room</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{waitingCount}</div>
                        <p className="text-xs text-muted-foreground">Patients waiting</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{inProgressCount}</div>
                        <p className="text-xs text-muted-foreground">Active consultations</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Patient Queue</CardTitle>
                    <CardDescription>Today's appointments and walk-ins for your branch.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>ID / Number</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : visits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No patients in queue for today.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visits.map((visit) => (
                                    <TableRow key={visit.id}>
                                        <TableCell className="font-mono text-xs">
                                            {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{visit.members?.full_name}</p>
                                                <p className="text-xs text-muted-foreground">{visit.members?.age} yrs</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{visit.members?.member_number}</TableCell>
                                        <TableCell>
                                            <Badge variant={visit.status === 'with_doctor' ? 'default' : 'secondary'}>
                                                {visit.status === 'with_doctor' ? 'In Progress' : 'Waiting'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="sm" onClick={() => handleStartConsultation(visit.id, visit.status)}>
                                                {visit.status === 'with_doctor' ? 'Continue' : 'Start Consultation'}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}