import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Send, ArrowLeft, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DentalChart } from "@/components/doctor/DentalChart";

export default function Consultation() {
    const { visitId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [visit, setVisit] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
    const [toothStatus, setToothStatus] = useState<Record<number, string>>({});
    const [diagnosis, setDiagnosis] = useState(""); // Renamed from notes to diagnosis
    const [treatmentNotes, setTreatmentNotes] = useState(""); // New field for doctor's notes
    const [services, setServices] = useState<any[]>([]);
    const [selectedServices, setSelectedServices] = useState<any[]>([]);
    const [doctorId, setDoctorId] = useState<string | null>(null);

    useEffect(() => {
        if (visitId) {
            fetchDoctorInfo();
            loadVisitData();
            loadServices();
        }
    }, [visitId]);

    const fetchDoctorInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }
        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData) {
            toast({ title: "Error", description: "Could not retrieve doctor profile.", variant: "destructive" });
            navigate("/doctor");
            return;
        }
        setDoctorId(staffData.id);
    };

    const loadVisitData = async () => {
        setLoading(true);
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
            // Load existing dental records
            const { data: records } = await supabase.from("dental_records").select("tooth_number, status").eq("member_id", data.member_id);
            if (records) {
                const statuses: any = {};
                records.forEach((r: any) => statuses[r.tooth_number] = r.status);
                setToothStatus(statuses);
            }
            if (data.diagnosis) setDiagnosis(data.diagnosis);
            if (data.treatment_notes) setTreatmentNotes(data.treatment_notes);

            // If status is 'registered', update to 'with_doctor'
            if (data.status === 'registered' && doctorId) {
                const { error: updateStatusError } = await supabase
                    .from("visits")
                    .update({ status: 'with_doctor', doctor_id: doctorId })
                    .eq("id", visitId);
                if (updateStatusError) console.error("Error updating visit status:", updateStatusError);
            }
        }
        setLoading(false);
    };

    const loadServices = async () => {
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
        setSelectedTeeth([]);
        toast({ title: "Chart Updated", description: `${selectedTeeth.length} teeth marked as ${status}` });
    };

    const addService = (serviceId: string) => {
        const service = services.find(s => s.id === serviceId);
        if (service && !selectedServices.find(s => s.id === serviceId)) {
            setSelectedServices([...selectedServices, service]);
        }
    };

    const removeService = (serviceId: string) => {
        setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
    };

    const handleSaveDraft = async () => {
        if (!visitId) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from("visits").update({
                diagnosis: diagnosis,
                treatment_notes: treatmentNotes,
            }).eq("id", visitId);

            if (error) throw error;

            // Save dental records
            const recordsToUpsert = Object.entries(toothStatus).map(([tooth_number, status]) => ({
                member_id: visit.member_id,
                visit_id: visitId,
                tooth_number: parseInt(tooth_number),
                status: status,
                notes: `Updated in visit ${visitId}`
            }));

            if (recordsToUpsert.length > 0) {
                const { error: dentalError } = await supabase.from("dental_records").upsert(recordsToUpsert, { onConflict: 'member_id,tooth_number' });
                if (dentalError) throw dentalError;
            }

            toast({ title: "Draft Saved", description: "Clinical notes and dental chart changes saved." });
        } catch (error: any) {
            toast({ title: "Error saving draft", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalize = async () => {
        if (!visitId || !doctorId) return;
        if (selectedServices.length === 0) {
            toast({ title: "Select Services", description: "Please add at least one service.", variant: "destructive" });
            return;
        }

        setSubmitting(true);
        try {
            // 1. Save Dental Records (if any changes were made)
            const recordsToUpsert = Object.entries(toothStatus).map(([tooth_number, status]) => ({
                member_id: visit.member_id,
                visit_id: visitId,
                tooth_number: parseInt(tooth_number),
                status: status,
                notes: `Updated in visit ${visitId}`
            }));

            if (recordsToUpsert.length > 0) {
                const { error: dentalError } = await supabase.from("dental_records").upsert(recordsToUpsert, { onConflict: 'member_id,tooth_number' });
                if (dentalError) throw dentalError;
            }

            // 2. Calculate Bill Totals
            const totalBenefit = selectedServices.reduce((acc, s) => acc + Number(s.benefit_cost), 0);
            const totalCompensation = selectedServices.reduce((acc, s) => acc + Number(s.branch_compensation), 0);
            const totalReal = selectedServices.reduce((acc, s) => acc + Number(s.real_cost), 0);
            const totalProfitLoss = totalBenefit - totalCompensation; // Profit/Loss is benefit - compensation

            // 3. Create Bill
            const { data: bill, error: billError } = await supabase.from("bills").insert({
                visit_id: visitId,
                total_benefit_cost: totalBenefit,
                total_branch_compensation: totalCompensation,
                total_real_cost: totalReal,
                total_profit_loss: totalProfitLoss,
                is_finalized: false, // Receptionist finalizes
            }).select().single();

            if (billError) throw billError;

            // 4. Add Bill Items
            const itemsToInsert = selectedServices.map(s => ({
                bill_id: bill.id,
                service_id: s.id,
                service_name: s.name,
                benefit_cost: s.benefit_cost,
                branch_compensation: s.branch_compensation,
                real_cost: s.real_cost
            }));

            const { error: itemsError } = await supabase.from("bill_items").insert(itemsToInsert);
            if (itemsError) throw itemsError;

            // 5. Update Visit Status and Doctor Notes
            const { error: visitUpdateError } = await supabase.from("visits").update({
                status: 'billed', // Change status to 'billed'
                diagnosis: diagnosis,
                treatment_notes: treatmentNotes,
                doctor_id: doctorId,
                // These fields are now derived from the bill, so set to 0 or remove from visits table
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0,
                service_id: '00000000-0000-0000-0000-000000000000' // Placeholder, as services are now in bill_items
            }).eq("id", visitId);

            if (visitUpdateError) throw visitUpdateError;

            toast({ title: "Consultation Completed", description: "Bill generated and sent to reception for finalization." });
            navigate("/doctor");

        } catch (error: any) {
            toast({ title: "Failed to finalize", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !visit || !doctorId) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => navigate("/doctor")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Consultation - {visit.members.full_name}</h1>
                    <p className="text-muted-foreground">Visit #{visitId?.slice(0, 8)} • ID: {visit.members.id_number}</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dental Chart</CardTitle>
                            <CardDescription>Select teeth to update clinical status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DentalChart
                                onToothClick={handleToothClick}
                                selectedTeeth={selectedTeeth}
                                toothStatus={toothStatus}
                            />
                            {selectedTeeth.length > 0 && (
                                <div className="mt-4 p-4 border rounded bg-primary/5 flex gap-2 justify-center flex-wrap">
                                    <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate('decay')}>Mark Decay</Button>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleStatusUpdate('planned')}>Plan Treatment</Button>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusUpdate('completed')}>Mark Completed</Button>
                                    <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('healthy')}>Mark Healthy</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Clinical Notes & Diagnosis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="diagnosis">Diagnosis</Label>
                                    <Textarea
                                        id="diagnosis"
                                        placeholder="Enter diagnosis..."
                                        className="min-h-[80px]"
                                        value={diagnosis}
                                        onChange={(e) => setDiagnosis(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="treatmentNotes">Treatment Notes</Label>
                                    <Textarea
                                        id="treatmentNotes"
                                        placeholder="Enter treatment notes..."
                                        className="min-h-[120px]"
                                        value={treatmentNotes}
                                        onChange={(e) => setTreatmentNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={handleSaveDraft} disabled={submitting}>
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Draft
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Services Provided</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    onChange={(e) => addService(e.target.value)}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select a service to add...</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (Benefit: KES {s.benefit_cost.toLocaleString()})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="border rounded-md divide-y">
                                {selectedServices.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground">No services selected yet.</div>
                                ) : (
                                    selectedServices.map(s => (
                                        <div key={s.id} className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <div className="font-semibold">{s.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Benefit: KES {s.benefit_cost.toLocaleString()} | Comp: KES {s.branch_compensation.toLocaleString()} | Real: KES {s.real_cost.toLocaleString()}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => removeService(s.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Patient Eligibility</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Member Number</span>
                                <span className="font-medium">{visit.members.member_number}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Coverage Balance</span>
                                <span className="font-bold text-green-600">KES {visit.members.coverage_balance?.toLocaleString()}</span>
                            </div>
                            <div className="pt-2 border-t">
                                <Label>Billing Summary</Label>
                                <div className="mt-2 space-y-1">
                                    <div className="flex justify-between">
                                        <span>Total Benefit Cost:</span>
                                        <span>KES {selectedServices.reduce((acc, s) => acc + Number(s.benefit_cost), 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-primary">
                                        <span>Estimated Coverage Deduction:</span>
                                        <span>KES {Math.min(selectedServices.reduce((acc, s) => acc + Number(s.benefit_cost), 0), visit.members.coverage_balance || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        className="w-full h-12 text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700"
                        onClick={handleFinalize}
                        disabled={submitting || selectedServices.length === 0}
                    >
                        {submitting ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-5 w-5" />}
                        Submit Consultation
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                        Bill will be sent to Reception for finalization and deduction.
                    </p>
                </div>
            </div>
        </div>
    );
}