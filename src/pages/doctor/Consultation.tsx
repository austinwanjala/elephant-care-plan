import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Send, ArrowLeft, Trash2, Plus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DentalChart, DentalChartMode } from "@/components/doctor/DentalChart";

export default function Consultation() {
    const { visitId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [visit, setVisit] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
    const [toothStatus, setToothStatus] = useState<Record<number, string>>({});
    const [diagnosis, setDiagnosis] = useState("");
    const [treatmentNotes, setTreatmentNotes] = useState("");
    const [availableServices, setAvailableServices] = useState<any[]>([]);
    const [selectedServices, setSelectedServices] = useState<{ service: any, tooth_number: number | null }[]>([]);
    const [serviceHistory, setServiceHistory] = useState<any[]>([]);
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [doctorBranchId, setDoctorBranchId] = useState<string | null>(null);
    const [chartMode, setChartMode] = useState<DentalChartMode>('adult');



    const [activeStages, setActiveStages] = useState<any[]>([]);

    useEffect(() => {
        if (visitId) {
            fetchDoctorInfo();
        }
    }, [visitId]);

    useEffect(() => {
        if (doctorId && doctorBranchId) {
            loadVisitData();
            loadServices(doctorBranchId);
        }
    }, [doctorId, doctorBranchId]);

    const fetchDoctorInfo = async () => {
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

        if (staffError || !staffData) {
            toast({ title: "Error", description: "Could not retrieve doctor profile.", variant: "destructive" });
            navigate("/doctor");
            return;
        }
        setDoctorId(staffData.id);
        setDoctorBranchId(staffData.branch_id);
    };

    const loadVisitData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(*), dependants(*)")
            .eq("id", visitId)
            .single();

        if (error) {
            toast({ title: "Error loading visit", description: error.message, variant: "destructive" });
            navigate("/doctor");
        } else {
            setVisit(data);

            // Fetch active multi-stage treatments
            const { data: stages } = await supabase
                .from("service_stages")
                .select("*, services(name)")
                .eq("member_id", data.member_id)
                .eq("dependant_id", data.dependant_id || null) // Handle nullable dependant
                .eq("status", "in_progress");

            if (stages) setActiveStages(stages);

            const { data: records, error: recordsError } = await supabase
                .from("dental_records")
                .select("tooth_number, status")
                .eq("member_id", data.member_id)
                .eq("dependant_id", data.dependant_id || null); // Filter by dependant if exists, else null (for principal)

            if (records) {
                const statuses: any = {};
                records.forEach((r: any) => statuses[r.tooth_number] = r.status);
                setToothStatus(statuses);
            }

            const { data: history } = await supabase
                .from("dental_chart_records")
                .select("tooth_number, service_id, created_at")
                .eq("member_id", data.member_id)
                .eq("dependant_id", data.dependant_id || null);

            if (history) {
                setServiceHistory(history);
            }

            if (data.diagnosis) setDiagnosis(data.diagnosis);
            if (data.treatment_notes) setTreatmentNotes(data.treatment_notes);

            if (data.status === 'registered' && doctorId) {
                await supabase
                    .from("visits")
                    .update({ status: 'with_doctor', doctor_id: doctorId })
                    .eq("id", visitId);
            }
        }
        setLoading(false);
    };

    // Calculate age (approximation or exact if available)
    const getPatientAge = () => {
        if (!visit) return 0;

        let dob;
        // Prioritize dependant DOB if it's a dependant visit
        if (visit.dependant_id && visit.dependants?.dob) {
            dob = visit.dependants.dob;
        } else if (visit.members?.dob) {
            dob = visit.members.dob;
        } else if (visit.members?.age) {
            return visit.members.age;
        }

        if (!dob) return 0;

        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Auto-set chart mode based on age when visit loads
    useEffect(() => {
        if (!visit) return;
        const age = getPatientAge();

        // Refined logic for dental chart modes
        if (age < 6) {
            setChartMode('child'); // Primary dentition only
        } else if (age <= 13) {
            setChartMode('mixed'); // Mixed dentition
        } else {
            setChartMode('adult');
        }
    }, [visit]);

    const loadServices = async (branchId: string) => {
        const { data: servicesData, error: servicesError } = await supabase
            .from("services")
            .select("*, service_preapprovals(branch_id)")
            .eq("is_active", true);

        if (servicesError) {
            toast({ title: "Error loading services", description: servicesError.message, variant: "destructive" });
            return;
        }

        const { data: branchData } = await supabase
            .from("branches")
            .select("is_globally_preapproved_for_services")
            .eq("id", branchId)
            .single();

        const filteredServices = servicesData?.filter(service => {
            if (service.approval_type === 'all_branches') return true;
            if (branchData?.is_globally_preapproved_for_services) return true;
            return service.service_preapprovals.some((preapproval: any) => preapproval.branch_id === branchId);
        }) || [];

        setAvailableServices(filteredServices);
    };

    const handleToothClick = (toothId: number) => {
        if (selectedTeeth.includes(toothId)) {
            setSelectedTeeth(selectedTeeth.filter(id => id !== toothId));
        } else {
            setSelectedTeeth([...selectedTeeth, toothId]);
        }
    };

    const addService = (serviceId: string) => {
        if (!serviceId) return;
        const service = availableServices.find(s => s.id === serviceId);
        if (!service) return;

        // Check if this is a multi-stage service and there's already an active stage
        const existingStage = activeStages.find(stage => stage.service_id === serviceId);
        if (existingStage) {
            toast({
                title: "Active Stage Exists",
                description: `This patient is already in Stage ${existingStage.current_stage} of ${existingStage.total_stages} for ${service.name}. Please use the 'Multi-Stage Treatments' panel to continue.`,
                variant: 'destructive'
            });
            return;
        }

        if (selectedTeeth.length > 0) {
            let addedCount = 0;
            const newSelections = [...selectedServices];
            const blockedTeeth: number[] = [];

            selectedTeeth.forEach(tooth => {
                if (newSelections.find(s => s.service.id === serviceId && s.tooth_number === tooth)) {
                    return;
                }

                const hasExistingRecord = serviceHistory.some(h =>
                    h.tooth_number == tooth && h.service_id === serviceId
                );

                if (hasExistingRecord) {
                    blockedTeeth.push(tooth);
                } else {
                    newSelections.push({ service, tooth_number: tooth });
                    addedCount++;
                }
            });

            if (blockedTeeth.length > 0) {
                toast({
                    title: "Service Blocked",
                    description: `Cannot perform ${service.name} on teeth: ${blockedTeeth.join(", ")} as it has been done previously.`,
                    variant: "destructive"
                });
            }

            if (addedCount > 0) {
                setSelectedServices(newSelections);
                toast({ title: "Services Added", description: `Added ${service.name} for ${addedCount} teeth.` });
                setSelectedTeeth([]);
            }

        } else {
            toast({ title: "General Service", description: "Added as general service (no tooth specified)." });
            if (!selectedServices.find(s => s.service.id === serviceId && s.tooth_number === null)) {
                setSelectedServices([...selectedServices, { service, tooth_number: null }]);
            }
        }
    };

    const handleContinueStage = (stage: any) => {
        if (selectedServices.find(s => s.service.stageId === stage.id)) {
            toast({ title: "Already Added", description: "This stage progression is already in the list.", variant: "secondary" });
            return;
        }

        const nextStageNum = stage.current_stage + 1;
        const isFinal = nextStageNum === stage.total_stages;

        // Create a 'virtual' service object for the bill
        const stageService = {
            id: stage.service_id,
            name: `${stage.services.name} (Stage ${nextStageNum}/${stage.total_stages})`,
            benefit_cost: 0, // No charge for subsequent stages
            branch_compensation: 0,
            real_cost: 0,
            is_multi_stage_update: true,
            stageId: stage.id,
            nextStage: nextStageNum,
            isFinal: isFinal
        };

        setSelectedServices([...selectedServices, { service: stageService, tooth_number: null }]);
        toast({ title: "Stage Added", description: `Scheduled completion of Stage ${nextStageNum}.` });
    };

    const removeService = (index: number) => {
        const newServices = [...selectedServices];
        newServices.splice(index, 1);
        setSelectedServices(newServices);
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

            const recordsToUpsert = Object.entries(toothStatus).map(([tooth_number, status]) => ({
                member_id: visit.member_id,
                dependant_id: visit.dependant_id || null, // Add dependant_id
                visit_id: visitId,
                tooth_number: parseInt(tooth_number),
                status: status,
                notes: `Updated in visit ${visitId}`
            }));

            if (recordsToUpsert.length > 0) {
                // We need to use a conflict strategy. 
                // Ideally (member_id, dependant_id, tooth_number) or just (dependant_id, tooth_number) if dependant_id is NN.
                // But since dependant_id is nullable, unique constraints are tricky in some DBs without Partial Index.
                // PostgreSQL handles (col1, col2) unique where col2 is null as distinct.
                // We might need to handle this carefully.
                // For now, let's assume the upsert works if we have the constraint.
                // If not, we might need a stored procedure or just delete insert.
                const { error: dentalError } = await supabase.from("dental_records").upsert(recordsToUpsert as any);
                // Removed explicit onConflict to let supabase infer from PK or unique set.
                // Or better: ensure we have a unique constraint.
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

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { data: existingBills, error: checkError } = await supabase
            .from("bills")
            .select("id")
            .eq("member_id", visit.member_id)
            .gte("created_at", todayStart.toISOString())
            .lte("created_at", todayEnd.toISOString());

        if (checkError) {
            toast({ title: "Error checking limits", description: checkError.message, variant: "destructive" });
            return;
        }

        if (existingBills && existingBills.length > 0) {
            toast({
                title: "Daily Limit Reached",
                description: "A claim has already been submitted for this member today. Only one claim per day is allowed.",
                variant: "destructive"
            });
            return;
        }

        setSubmitting(true);
        try {
            const recordsToUpsert = Object.entries(toothStatus).map(([tooth_number, status]) => ({
                member_id: visit.member_id,
                dependant_id: visit.dependant_id || null, // Add dependant_id
                visit_id: visitId,
                tooth_number: parseInt(tooth_number),
                status: status,
                notes: `Updated in visit ${visitId}`
            }));

            if (recordsToUpsert.length > 0) {
                const { error: dentalError } = await supabase.from("dental_records").upsert(recordsToUpsert as any);
                if (dentalError) throw dentalError;
            }

            const totalBenefit = selectedServices.reduce((acc, s) => acc + Number(s.service.benefit_cost || 0), 0);
            const totalCompensation = selectedServices.reduce((acc, s) => acc + Number(s.service.branch_compensation || 0), 0);
            const totalReal = selectedServices.reduce((acc, s) => acc + Number(s.service.real_cost || 0), 0);
            const totalProfitLoss = totalBenefit - totalCompensation;

            // Determine if bill should be claimable immediately
            // If it contains a NEW multi-stage service, it is NOT claimable yet.
            const hasNewMultiStage = selectedServices.some(s => s.service.is_multi_stage && !s.service.is_multi_stage_update);
            const isClaimable = !hasNewMultiStage;

            const { data: bill, error: billError } = await supabase.from("bills").insert({
                visit_id: visitId,
                branch_id: doctorBranchId,
                total_benefit_cost: totalBenefit,
                total_branch_compensation: totalCompensation,
                total_real_cost: totalReal,
                total_profit_loss: totalProfitLoss,
                is_finalized: false,
                is_claimable: isClaimable
            }).select().single();

            if (billError) throw billError;

            const itemsToInsert = selectedServices.map(s => ({
                bill_id: bill.id,
                service_id: s.service.id,
                service_name: s.service.name,
                benefit_cost: s.service.benefit_cost || 0,
                branch_compensation: s.service.branch_compensation || 0,
                real_cost: s.service.real_cost || 0,
                tooth_number: s.tooth_number ? s.tooth_number.toString() : null
            }));

            const { error: itemsError } = await supabase.from("bill_items").insert(itemsToInsert);
            if (itemsError) throw itemsError;

            // Handle Multi-Stage Updates
            for (const item of selectedServices) {
                // 1. New Multi-Stage Service (Stage 1)
                if (item.service.is_multi_stage && !item.service.is_multi_stage_update) {
                    await supabase.from("service_stages").insert({
                        service_id: item.service.id,
                        member_id: visit.member_id,
                        dependant_id: visit.dependant_id || null,
                        visit_id: visitId,
                        current_stage: 1,
                        total_stages: item.service.total_stages,
                        status: 'in_progress',
                        notes: `Started in visit ${visitId}`
                    });
                }
                // 2. Existing Stage Update
                else if (item.service.is_multi_stage_update) {
                    await supabase.from("service_stages").update({
                        current_stage: item.service.nextStage,
                        status: item.service.isFinal ? 'completed' : 'in_progress',
                        visit_id: visitId,
                        updated_at: new Date().toISOString()
                    }).eq('id', item.service.stageId);

                    // If Final Stage, unlock previous bills for this service
                    if (item.service.isFinal) {
                        try {
                            // Find bills that contain this service for this member and are not claimable
                            // We need to look up bill_items -> bills
                            // This is a bit complex via client, ideally a stored proc, but let's try 2-step
                            const { data: items } = await supabase
                                .from("bill_items")
                                .select("bill_id")
                                .eq("service_id", item.service.id);

                            const billIds = items?.map(i => i.bill_id) || [];

                            if (billIds.length > 0) {
                                await supabase
                                    .from("bills")
                                    .update({ is_claimable: true })
                                    .in("id", billIds)
                                    .eq("member_id", visit.member_id)
                                    .eq("is_claimable", false);
                            }
                        } catch (e) {
                            console.error("Error unlocking bills:", e);
                        }
                    }
                }
            }

            const chartRecordsToInsert = selectedServices
                .filter(s => s.tooth_number !== null)
                .map(s => ({
                    member_id: visit.member_id,
                    dependant_id: visit.dependant_id || null, // Add dependant_id
                    bill_id: bill.id,
                    service_id: s.service.id,
                    tooth_number: s.tooth_number!.toString(),
                    notes: `Procedure performed on visit ${visitId}`,
                }));

            if (chartRecordsToInsert.length > 0) {
                const { error: chartError } = await supabase.from("dental_chart_records").insert(chartRecordsToInsert);
                if (chartError) throw chartError;
            }

            const { error: visitUpdateError } = await supabase.from("visits").update({
                status: 'billed',
                diagnosis: diagnosis,
                treatment_notes: treatmentNotes,
                doctor_id: doctorId,
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0
            }).eq("id", visitId);

            if (visitUpdateError) throw visitUpdateError;

            toast({ title: "Consultation Completed", description: "Bill generated and sent to reception for finalization." });

            await (supabase as any).from("system_logs").insert({
                action: "Consultation Submitted",
                details: { visit_id: visitId, doctor_id: doctorId, services_count: selectedServices.length, bill_id: bill.id },
                user_id: (await supabase.auth.getUser()).data.user?.id
            });

            navigate("/doctor");

        } catch (error: any) {
            console.error("Finalize error:", error);
            toast({ title: "Failed to finalize", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !visit || !doctorId || !doctorBranchId) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;

    // Determine patient details (Principal or Dependant)
    const patientName = visit.dependants?.full_name || visit.members.full_name;
    const patientDob = visit.dependants?.dob || visit.members.dob;

    // Calculate age (approximation)


    const patientAge = getPatientAge();
    const isChild = patientAge <= 14;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => navigate("/doctor")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Consultation - {patientName} {isChild && <span className="text-sm font-normal text-amber-600 ml-2">(Pediatric)</span>}</h1>
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground">Visit #{visitId?.slice(0, 8)} • ID: {visit.dependants?.document_number || visit.members.id_number || 'N/A'} • Age: {patientAge} yrs</p>
                        {visit.dependants && (
                            <p className="text-sm text-muted-foreground">Principal Member: <span className="font-medium text-foreground">{visit.members.full_name}</span> ({visit.members.member_number})</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {activeStages.length > 0 && (
                        <Card className="border-blue-200 bg-blue-50/50">
                            <CardHeader>
                                <CardTitle className="text-blue-800 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Active Multi-Stage Treatments
                                </CardTitle>
                                <CardDescription>This patient has ongoing treatments that require multiple visits.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeStages.map(stage => (
                                    <div key={stage.id} className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
                                        <div>
                                            <h4 className="font-bold text-foreground">{stage.services.name}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Currently at <span className="font-medium text-blue-600">Stage {stage.current_stage}</span> of {stage.total_stages}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className={stage.current_stage + 1 === stage.total_stages ? "bg-green-600 hover:bg-green-700" : ""}
                                            onClick={() => handleContinueStage(stage)}
                                            disabled={selectedServices.some(s => s.service.stageId === stage.id)}
                                        >
                                            {selectedServices.some(s => s.service.stageId === stage.id)
                                                ? "Added to Bill"
                                                : stage.current_stage + 1 === stage.total_stages
                                                    ? "Complete Final Stage"
                                                    : `Complete Stage ${stage.current_stage + 1}`
                                            }
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Dental Chart (FDI)</CardTitle>
                                    <CardDescription>Select teeth to add services or update clinical status.</CardDescription>
                                </div>
                                <div className="flex gap-1 bg-secondary/10 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                                    {chartMode === 'child' && <span>Pediatric Mode</span>}
                                    {chartMode === 'mixed' && <span>Mixed Dentition Mode (Pediatric)</span>}
                                    {chartMode === 'adult' && <span>Adult Mode</span>}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DentalChart
                                onToothClick={handleToothClick}
                                selectedTeeth={selectedTeeth}
                                toothStatus={toothStatus}
                                mode={chartMode}
                            />
                            {selectedTeeth.length > 0 && (
                                <div className="mt-4 space-y-4">
                                    <div className="p-4 border rounded bg-secondary/20">
                                        <Label>Add Procedure for Selected Teeth ({selectedTeeth.join(", ")})</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                                            onChange={(e) => {
                                                addService(e.target.value);
                                                e.target.value = "";
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Select a procedure to perform on these teeth...</option>
                                            {availableServices.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} (Benefit: KES {s.benefit_cost.toLocaleString()})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Dental Chart (FDI)</CardTitle>
                                    <CardDescription>Select teeth to add services or update clinical status.</CardDescription>
                                </div>
                                <div className="flex gap-1 bg-secondary/10 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                                    {chartMode === 'child' && <span>Pediatric Mode</span>}
                                    {chartMode === 'mixed' && <span>Mixed Dentition Mode (Pediatric)</span>}
                                    {chartMode === 'adult' && <span>Adult Mode</span>}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DentalChart
                                onToothClick={handleToothClick}
                                selectedTeeth={selectedTeeth}
                                toothStatus={toothStatus}
                                mode={chartMode}
                            />
                            {selectedTeeth.length > 0 && (
                                <div className="mt-4 space-y-4">
                                    <div className="p-4 border rounded bg-secondary/20">
                                        <Label>Add Procedure for Selected Teeth ({selectedTeeth.join(", ")})</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                                            onChange={(e) => {
                                                addService(e.target.value);
                                                e.target.value = "";
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Select a procedure to perform on these teeth...</option>
                                            {availableServices.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} (Benefit: KES {s.benefit_cost.toLocaleString()})</option>
                                            ))}
                                        </select>
                                    </div>
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
                            <CardTitle>Billable Services</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border rounded-md divide-y">
                                {selectedServices.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground">No services added yet. Select teeth and choose a procedure.</div>
                                ) : (
                                    selectedServices.map((s, index) => (
                                        <div key={`${s.service.id}-${index}`} className="p-4 flex justify-between items-center bg-white">
                                            <div>
                                                <div className="font-semibold">{s.service.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {s.tooth_number ? <span className="font-bold text-primary mr-2">Tooth #{s.tooth_number}</span> : <span className="mr-2 italic">No tooth specified</span>}
                                                    Benefit: KES {s.service.benefit_cost.toLocaleString()}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => removeService(index)}>
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
                                        <span>KES {selectedServices.reduce((acc, s) => acc + Number(s.service.benefit_cost), 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-primary">
                                        <span>Estimated Coverage Deduction:</span>
                                        <span>KES {Math.min(selectedServices.reduce((acc, s) => acc + Number(s.service.benefit_cost), 0), visit.members.coverage_balance || 0).toLocaleString()}</span>
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
                        Submit Bill
                    </Button>
                </div>
            </div>
        </div>
    );
}