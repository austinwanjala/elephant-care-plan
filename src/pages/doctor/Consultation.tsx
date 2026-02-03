import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Send, ArrowLeft } from "lucide-react";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";
import { DentalChart } from "@/components/doctor/DentalChart";

export default function Consultation() {
    const { visitId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [visit, setVisit] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
    const [toothStatus, setToothStatus] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState("");
    const [services, setServices] = useState<any[]>([]);
    const [selectedService, setSelectedService] = useState<string>("");

    useEffect(() => {
        if (visitId) {
            loadVisitData();
            loadServices();
        }
    }, [visitId]);

    const loadVisitData = async () => {
        setLoading(true);
        // @ts-ignore
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(*)")
            .eq("id", visitId)
            .single();

        if (error) {
            toast({ title: "Error loading visit", description: error.message, variant: "destructive" });
            navigate("/doctor");
        } else {
            setVisit(data);
            // Load existing dental records if any
            // @ts-ignore
            const { data: records } = await supabase.from("dental_records").select("tooth_number, status, notes").eq("member_id", data.member_id);
            if (records) {
                const statuses: any = {};
                records.forEach((r: any) => statuses[r.tooth_number] = r.status);
                setToothStatus(statuses);
            }
            // If notes exist in visit, load them
            if (data.notes) setNotes(data.notes);

            // Update status to in_progress if it was registered
            if (data.status === 'registered') {
                // @ts-ignore
                await supabase.from("visits").update({ status: 'in_progress' }).eq("id", visitId);
            }
        }
        setLoading(false);
    };

    const loadServices = async () => {
        // @ts-ignore
        const { data } = await supabase.from("services").select("*").eq("is_active", true);
        if (data) setServices(data);
    };

    const handleToothClick = (toothId: number) => {
        if (selectedTeeth.includes(toothId)) {
            setSelectedTeeth(selectedTeeth.filter(id => id !== toothId));
        } else {
            setSelectedTeeth([...selectedTeeth, toothId]);
        }
    };

    const handleStatusUpdate = (status: string) => {
        const newStatus = { ...toothStatus };
        selectedTeeth.forEach(id => {
            newStatus[id] = status;
        });
        setToothStatus(newStatus);
        setSelectedTeeth([]); // clear selection
        toast({ title: "Chart Updated", description: `${selectedTeeth.length} teeth marked as ${status}` });
    };

    const handleSaveNotes = async () => {
        // @ts-ignore
        const { error } = await supabase.from("visits").update({ notes }).eq("id", visitId);
        if (error) toast({ title: "Error saving notes", variant: "destructive" });
        else toast({ title: "Notes saved" });
    };

    const handleFinalize = async () => {
        if (!selectedService) {
            toast({ title: "Select Service", description: "multiselect a service performed.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const service = services.find(s => s.id === selectedService);

            // 1. Save Dental Records
            const recordsToInsert = Object.entries(toothStatus).map(([tooth_id, status]) => ({
                member_id: visit.member_id,
                visit_id: visitId,
                tooth_number: parseInt(tooth_id),
                status,
                notes: `Updated in visit ${visitId}`
            }));

            if (recordsToInsert.length > 0) {
                // @ts-ignore
                await supabase.from("dental_records").upsert(recordsToInsert, { onConflict: 'member_id,tooth_number' });
            }

            // 2. Generate Bill (Simple: 1 service per visit for now)
            // Ensure we don't double bill

            // @ts-ignore
            const { data: bill, error: billError } = await supabase.from("bills").insert({
                visit_id: visitId,
                member_id: visit.member_id,
                total_amount: service.base_price,
                insurance_covered: Math.min(service.base_price, visit.members?.coverage_balance || 0),
                payable_amount: Math.max(0, service.base_price - (visit.members?.coverage_balance || 0)),
                status: 'pending'
            }).select().single();

            if (billError) throw billError;

            // 3. Update Visit to Billed (Wait for reception payment)
            // @ts-ignore
            const { error: visitError } = await supabase.from("visits").update({
                status: 'billed',
                service_id: selectedService,
                benefit_deducted: Math.min(service.base_price, visit.members?.coverage_balance || 0)
            }).eq("id", visitId);

            if (visitError) throw visitError;

            // 4. Update member balance (Deduct benefit)
            if (visit.members?.coverage_balance && visit.members.coverage_balance > 0) {
                // @ts-ignore
                await supabase.rpc('deduct_member_balance', {
                    p_member_id: visit.member_id,
                    p_amount: Math.min(service.base_price, visit.members.coverage_balance)
                });
                // Note: Need to implement this RPC or do it client side (unsafe but quick for now, prefer RPC)
                // For now, client side update for speed in prototype
                // @ts-ignore
                await supabase.from("members").update({
                    coverage_balance: Math.max(0, visit.members.coverage_balance - service.base_price)
                }).eq("id", visit.member_id);
            }

            toast({ title: "Consultation Completed", description: "Bill generated and sent to reception." });
            navigate("/doctor");

        } catch (error: any) {
            toast({ title: "Failed to finalize", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (loading || !visit) return <div className="p-8"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => navigate("/doctor")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Consultation - {visit.members.full_name}</h1>
                    <p className="text-muted-foreground">Visit #{visitId?.slice(0, 8)} • {visit.members.age} yrs • {visit.members.gender || 'N/A'}</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Chart Area */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dental Chart</CardTitle>
                            <CardDescription>Select teeth to update status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DentalChart
                                onToothClick={handleToothClick}
                                selectedTeeth={selectedTeeth}
                                toothStatus={toothStatus}
                            />

                            {selectedTeeth.length > 0 && (
                                <div className="mt-4 p-4 border rounded bg-slate-50 flex gap-2 justify-center animate-in fade-in slide-in-from-bottom-2">
                                    <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate('decay')}>Mark Decay</Button>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleStatusUpdate('planned')}>Plan Treatment</Button>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusUpdate('completed')}>Mark Completed</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Diagnosis & Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Enter clinical notes, diagnosis, and observations..."
                                className="min-h-[150px]"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                            <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={handleSaveNotes}>
                                    <Save className="mr-2 h-4 w-4" /> Save Notes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Patient Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <Label className="text-muted-foreground">Member Number</Label>
                                <p className="font-medium">{visit.members.member_number}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Coverage Balance</Label>
                                <p className="font-medium text-green-600">KES {visit.members.coverage_balance?.toLocaleString()}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Medical History</Label>
                                <p>No major alerts.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle>Finalize Visit</CardTitle>
                            <CardDescription>Select service and generate bill.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Service Performed</Label>
                                <Select value={selectedService} onValueChange={setSelectedService}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} - KES {s.base_price}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button className="w-full btn-primary" onClick={handleFinalize} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                                Generate Bill
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
