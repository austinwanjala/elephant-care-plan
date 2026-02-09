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

        const { data, error } = await supabase
            .from("visits")
            .select("*, members(full_name, member_number, age)")
            .eq('branch_id', staffData.branch_id)
            .or(`doctor_id.eq.${staffData.id},doctor_id.is.null`)
            .or('status.eq.registered,status.eq.with_doctor')
            .gte('created_at', today)
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