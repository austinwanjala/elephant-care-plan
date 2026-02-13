import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function DoctorQueue() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchQueue();
    }, []);

    const fetchQueue = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staffData } = await supabase
            .from("staff")
            .select("id, branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!staffData) return;
        setDoctorId(staffData.id);

        const today = new Date().toISOString().split('T')[0];

        // Fetch visits: 
        // 1. Registered (Waiting) - Created Today
        // 2. With Doctor (In Progress) - Assigned to this doctor (ANY date to persist)
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(full_name, member_number, age, dob), dependants(*)")
            .eq('branch_id', staffData.branch_id)
            .or(`and(status.eq.registered,created_at.gte.${today}),and(status.eq.with_doctor,doctor_id.eq.${staffData.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            toast({ title: "Error fetching queue", description: error.message, variant: "destructive" });
        } else {
            setVisits(data || []);
        }
        setLoading(false);
    };

    const handleStartConsultation = async (visitId: string, currentStatus: string) => {
        if (currentStatus === 'registered') {
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Today's Queue</h1>
                <p className="text-muted-foreground">Patients waiting for consultation in your branch.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Active Queue
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
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
                                            No patients in queue.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visits.map((visit) => {
                                        const patientName = visit.dependants?.full_name || visit.members?.full_name;

                                        // Age Calculation Logic (Consistent with Consultation.tsx)
                                        const getAge = () => {
                                            if (visit.dependants?.dob) {
                                                const birthDate = new Date(visit.dependants.dob);
                                                const today = new Date();
                                                let age = today.getFullYear() - birthDate.getFullYear();
                                                const m = today.getMonth() - birthDate.getMonth();
                                                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                                    age--;
                                                }
                                                return age;
                                            }
                                            if (visit.members?.age) return visit.members.age;
                                            if (visit.members?.dob) {
                                                const birthDate = new Date(visit.members.dob);
                                                const today = new Date();
                                                let age = today.getFullYear() - birthDate.getFullYear();
                                                const m = today.getMonth() - birthDate.getMonth();
                                                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                                    age--;
                                                }
                                                return age;
                                            }
                                            return 0;
                                        };

                                        const patientAge = getAge();
                                        const isDependant = !!visit.dependants;

                                        return (
                                            <TableRow key={visit.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    <div className="text-[10px] text-muted-foreground">{new Date(visit.created_at).toLocaleDateString()}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium flex items-center gap-2">
                                                            {patientName}
                                                            {isDependant && <Badge variant="outline" className="text-[10px] h-4 px-1">Dependant</Badge>}
                                                            {patientAge <= 14 && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-800 hover:bg-amber-100">Pediatric</Badge>}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{patientAge} yrs</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{visit.dependants?.document_number ? `ID: ${visit.dependants.document_number}` : (visit.members?.member_number || '-')}</span>
                                                        {isDependant && <span className="text-[10px] text-muted-foreground">Principal: {visit.members?.full_name}</span>}
                                                    </div>
                                                </TableCell>
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
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}