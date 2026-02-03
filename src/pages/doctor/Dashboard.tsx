import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, ClipboardList, Clock, ArrowRight } from "lucide-react";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function DoctorDashboard() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchVisits();
    }, []);

    const fetchVisits = async () => {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        // Fetch visits that are 'registered' (waiting) or 'in_progress'
        // @ts-ignore
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(full_name, member_number, age, gender)")
            .or('status.eq.registered,status.eq.in_progress')
            .gte('created_at', today)
            .order('created_at', { ascending: true });

        if (error) {
            toast({ title: "Error fetching visits", description: error.message, variant: "destructive" });
        } else {
            setVisits(data || []);
        }
        setLoading(false);
    };

    const handleStartConsultation = (visitId: string) => {
        navigate(`/doctor/consultation/${visitId}`);
    };

    const waitingCount = visits.filter(v => v.status === 'registered').length;
    const inProgressCount = visits.filter(v => v.status === 'in_progress').length;

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
                    <CardDescription>Today's appointments and walk-ins.</CardDescription>
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
                                            <Badge variant={visit.status === 'in_progress' ? 'default' : 'secondary'}>
                                                {visit.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="sm" onClick={() => handleStartConsultation(visit.id)}>
                                                {visit.status === 'in_progress' ? 'Continue' : 'Start Consultation'}
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
