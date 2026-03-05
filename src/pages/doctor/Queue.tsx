import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ClipboardList, Clock, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CardScanner from "@/components/medical-card/CardScanner";
import { QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DoctorQueue() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [scanDialogOpen, setScanDialogOpen] = useState(false);
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

        // Fetch all active/pending visits allocated to the doctor
        const { data, error } = await (supabase as any)
            .from("visits")
            .select("*, members(full_name, member_number, age, dob), dependants(*)")
            .eq('branch_id', staffData.branch_id)
            .eq('assigned_doctor_id', staffData.id)
            .in('status', ['registered', 'with_doctor'])
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
                .update({ status: 'with_doctor', doctor_id: doctorId, assigned_doctor_id: doctorId })
                .eq("id", visitId);

            if (error) {
                toast({ title: "Error starting consultation", description: error.message, variant: "destructive" });
                return;
            }
        }
        navigate(`/doctor/consultation/${visitId}`);
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const todayVisits = visits.filter(v => v.created_at.startsWith(todayStr));
    const pastVisits = visits.filter(v => !v.created_at.startsWith(todayStr));

    const renderTable = (visitList: any[]) => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Time/Date</TableHead>
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
                    ) : visitList.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No patients in queue.
                            </TableCell>
                        </TableRow>
                    ) : (
                        visitList.map((visit) => {
                            const patientName = visit.dependants?.full_name || visit.members?.full_name;
                            const isToday = visit.created_at.startsWith(todayStr);

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
                                return visit.members?.age || "N/A";
                            };

                            return (
                                <TableRow key={visit.id} className={!isToday ? "bg-orange-50/30" : ""}>
                                    <TableCell>
                                        <div className="font-medium text-xs">
                                            {isToday
                                                ? new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : new Date(visit.created_at).toLocaleDateString()
                                            }
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{patientName}</div>
                                        <div className="text-xs text-muted-foreground">Age: {getAge()}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{visit.members?.member_number}</div>
                                        {visit.dependants && (
                                            <div className="text-xs text-muted-foreground">Dependant</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={visit.status === 'registered' ? 'secondary' : 'default'} className="text-[10px]">
                                            {visit.status.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            onClick={() => handleStartConsultation(visit.id, visit.status)}
                                            size="sm"
                                            className="h-8 gap-1.5"
                                        >
                                            {visit.status === 'registered' ? 'Start' : 'Continue'} <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">MY Queue</h1>
                <p className="text-muted-foreground">Manage your assigned patients and active consultations.</p>
            </div>

            <Tabs defaultValue="today" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="today" className="gap-2">
                        <Clock className="w-4 h-4" /> MY Queue ({todayVisits.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="w-4 h-4" /> Pending from Past ({pastVisits.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="today">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Patients Registered Today</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderTable(todayVisits)}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Incomplete Past Visits</CardTitle>
                            <CardDescription>Patients who were registered on previous days but haven't finished their consultations.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {renderTable(pastVisits)}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}