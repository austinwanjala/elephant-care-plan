import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Send, ArrowLeft, Trash2, Plus, AlertTriangle, Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DentalChart, DentalChartMode } from "@/components/doctor/DentalChart";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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

    // New State for Diagnosis/Treatment Separation
    const [consultationMode, setConsultationMode] = useState<'diagnosis' | 'treatment'>('diagnosis');
    const [diagnosisLockedAt, setDiagnosisLockedAt] = useState<string | null>(null);
    const [selectedDiagnosisTool, setSelectedDiagnosisTool] = useState<string>('decay'); // Default tool
    const [toothConditions, setToothConditions] = useState<Record<number, string>>({}); // status/condition map
    const [existingConditions, setExistingConditions] = useState<Record<number, boolean>>({}); // Lock map for historical data



    const [activeStages, setActiveStages] = useState<any[]>([]);
    const [stageDialogOpen, setStageDialogOpen] = useState(false);
    const [pendingService, setPendingService] = useState<any>(null);
    const [selectedStageNumber, setSelectedStageNumber] = useState(1);

    const [lockedVisitConditions, setLockedVisitConditions] = useState<Record<number, boolean>>({});

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

            if (data.diagnosis_locked_at) {
                setDiagnosisLockedAt(data.diagnosis_locked_at);
                setConsultationMode('treatment');
            } else {
                setConsultationMode('diagnosis');
            }

            // Fetch active multi-stage treatments
            const { data: stages } = await supabase
                .from("service_stages")
                .select("*, services(name), tooth_number, related_bill_id")
                .eq("member_id", data.member_id)
                .eq("dependant_id", data.dependant_id || null) // Handle nullable dependant
                .eq("status", "in_progress");

            if (stages) setActiveStages(stages);

            const { data: records, error: recordsError } = await supabase
                .from("dental_records")
                .select("tooth_number, status, condition, color, visit_id")
                .eq("member_id", data.member_id)
                .eq("dependant_id", data.dependant_id || null); // Filter by dependant if exists, else null (for principal)

            if (records) {
                const conditions: Record<number, string> = {};
                const history: Record<number, boolean> = {};
                const lockedThisVisit: Record<number, boolean> = {};

                records.forEach((r: any) => {
                    if (r.condition) conditions[r.tooth_number] = r.condition;
                    else if (r.status) conditions[r.tooth_number] = r.status;

                    // If record is from a DIFFERENT visit, it is historical and locked
                    if (r.visit_id !== visitId) {
                        history[r.tooth_number] = true;
                    }
                    // If it is THIS visit, check if it should be locked
                    else if (r.visit_id === visitId && data.diagnosis_locked_at) {
                        // Logic: "For new diagnosis the restriction should only after he clicked on save diagnosis otherwise he can change the diagnosis"
                        // This means if we loaded it from DB AND the visit has been saved/locked at least once, these are "Old Saved" diagnoses.
                        lockedThisVisit[r.tooth_number] = true;
                    }
                });
                setToothConditions(conditions);
                setExistingConditions(history);
                setLockedVisitConditions(lockedThisVisit);

                // Default to treatment mode logic...
                if (records.length > 0 && !data.diagnosis_locked_at) {
                    setConsultationMode('treatment');
                }
            }
            setLoading(false);
        }
    };

    // ... [Inside handleToothClick]
    // Check lockedVisitConditions
    // if (diagnosisLockedAt && lockedVisitConditions[toothId]) { ... }

    // But I will apply the full replacement block for loadVisitData section first.

    // For display in Treatment Mode, we want to overlay treatment status (e.g. in_progress)
    // DentalChart takes a single status.
    // We will compute `toothStatus` derived state during render or use effect.
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

// Compute effective tooth status for display
useEffect(() => {
    const effectiveStatus: Record<number, string> = { ...toothConditions };

    // Overlay active stages (In Progress)
    activeStages.forEach(stage => {
        if (stage.tooth_number) {
            effectiveStatus[stage.tooth_number] = 'in_progress';
        }
    });

    // Overlay current selections? 
    // DentalChart handles selection visually via `selectedTeeth` prop, but we might want to show 'planned' color?
    // 'Selected' usually implies 'Planned' in this context.
    // But `selectedTeeth` prop is array of IDs.

    setToothStatus(effectiveStatus);
}, [toothConditions, activeStages]);

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
    if (consultationMode === 'diagnosis') {
        // Check if tooth has historical diagnosis
        if (existingConditions[toothId]) {
            toast({ title: "Locked", description: "This diagnosis is from a previous visit and cannot be edited.", variant: "secondary" });
            return;
        }

        // Start handleToothClick update
        // Check if tooth has CURRENT diagnosis but we are in a "locked" state (returning from treatment)
        // Use local lockedVisitConditions state which tracks what is in the DB/saved.
        if (diagnosisLockedAt && lockedVisitConditions[toothId]) {
            toast({ title: "Saved", description: "This diagnosis has already been saved. You can only add new diagnoses.", variant: "secondary" });
            return;
        }
        // End handleToothClick update

        // Apply selected condition tool
        const currentCondition = toothConditions[toothId];
        if (currentCondition === selectedDiagnosisTool) {
            // Toggle off
            const newConditions = { ...toothConditions };
            delete newConditions[toothId];
            setToothConditions(newConditions);
        } else {
            // Apply tool
            setToothConditions({ ...toothConditions, [toothId]: selectedDiagnosisTool });
        }
    } else {
        // Treatment Mode - Select for service

        // Safety Check: Is this tooth selectable?
        // A tooth is selectable if it was diagnosed (present in toothConditions) OR has an active stage (from past visits)
        const isDiagnosed = !!toothConditions[toothId];
        const hasActiveStage = activeStages.some(s => s.tooth_number === toothId);

        if (!isDiagnosed && !hasActiveStage) {
            // Ignore click on disabled/healthy teeth
            return;
        }

        if (selectedTeeth.includes(toothId)) {
            setSelectedTeeth(selectedTeeth.filter(id => id !== toothId));
        } else {
            setSelectedTeeth([...selectedTeeth, toothId]);
        }
    }
};

const saveDiagnosis = async () => {
    if (!visitId) return;
    setSubmitting(true);
    try {
        // Upsert dental records with diagnosis
        const recordsToUpsert = Object.entries(toothConditions).map(([tooth_number, condition]) => ({
            member_id: visit.member_id,
            dependant_id: visit.dependant_id || null,
            visit_id: visitId,
            tooth_number: parseInt(tooth_number),
            condition: condition, // Save condition
            status: 'diagnosed',
            updated_at: new Date().toISOString()
        }));

        if (recordsToUpsert.length > 0) {
            const { error: dentalError } = await supabase.rpc('upsert_dental_records', { records: recordsToUpsert });
            if (dentalError) throw dentalError;
        }

        // Update visit diagnosis text and "lock" it (mark as passed diagnosis)
        const { error: visitError } = await supabase.from("visits").update({
            diagnosis: diagnosis,
            treatment_notes: treatmentNotes,
            diagnosis_locked_at: new Date().toISOString() // We still track this for state persistence
        }).eq("id", visitId);

        if (visitError) throw visitError;

        toast({
            title: "Diagnosis Saved",
            description: "Moving to treatment phase."
        });

        setDiagnosisLockedAt(new Date().toISOString());
        setConsultationMode('treatment');
        setSelectedTeeth([]);

    } catch (error: any) {
        console.error(error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setSubmitting(false);
    }
};

const performAddService = (service: any, startStage: number = 1) => {
    if (selectedTeeth.length > 0) {
        let addedCount = 0;
        const newSelections = [...selectedServices];
        const blockedTeeth: number[] = [];

        selectedTeeth.forEach(tooth => {
            if (newSelections.find(s => s.service.id === service.id && s.tooth_number === tooth)) {
                return;
            }

            // 1. Check History: Has this SPECIFIC service been done before?
            const hasExistingRecord = serviceHistory.some(h =>
                h.tooth_number == tooth && h.service_id === service.id
            );

            // 2. Check Active Stages: Is there ANY active treatment on this tooth?
            // The user says "another service cannot be done in a tooth that is actively being treated".
            // This implies exclusive lock on the tooth.
            // UNLESS it is the SAME service (continuation) - but continuation is handled in `addService` before this.
            // So if we are here, it's a "New Start".
            const hasActiveTreatment = activeStages.some(s => s.tooth_number === tooth);

            if (hasActiveTreatment) {
                blockedTeeth.push(tooth);
                // We can be specific about why
                // But for simplicity, we block.
            } else if (hasExistingRecord) {
                // Prevent repeating the same service (e.g. Root Canal done twice)
                // Unless it allows repeats? Assuming multi-stage logic implies "once done, done".
                blockedTeeth.push(tooth);
            } else {
                // Clone service to add stage info if needed
                const serviceWithStage = { ...service, startAtStage: startStage };
                newSelections.push({ service: serviceWithStage, tooth_number: tooth });
                addedCount++;
            }
        });

        if (blockedTeeth.length > 0) {
            toast({
                title: "Service Blocked",
                description: `Cannot perform ${service.name} (Stage ${startStage}) on teeth: ${blockedTeeth.join(", ")} as it has been done previously or is already in progress. activeStages: ${JSON.stringify(activeStages)}`, // Debug info potentially
                description: `Cannot start ${service.name} on teeth: ${blockedTeeth.join(", ")}. Treatment already completed or in progress.`,
                variant: "destructive"
            });
        }

        if (addedCount > 0) {
            setSelectedServices(newSelections);
            toast({ title: "Services Added", description: `Added ${service.name} for ${addedCount} teeth.` });
            setSelectedTeeth([]);
        }

    } else {
        const serviceWithStage = { ...service, startAtStage: startStage };
        toast({ title: "General Service", description: "Added as general service (no tooth specified)." });
        if (!selectedServices.find(s => s.service.id === service.id && s.tooth_number === null)) {
            setSelectedServices([...selectedServices, { service: serviceWithStage, tooth_number: null }]);
        }
    }
};

const addService = (serviceId: string) => {
    if (!serviceId) return;
    const service = availableServices.find(s => s.id === serviceId);
    if (!service) return;

    // Check active stages to auto-continue existing treatments
    if (selectedTeeth.length > 0) {
        const continueTeeth: number[] = [];

        selectedTeeth.forEach(tooth => {
            const existingStage = activeStages.find(stage =>
                stage.service_id === serviceId &&
                stage.tooth_number === tooth
            );
            if (existingStage) {
                continueTeeth.push(tooth);
            }
        });

        if (continueTeeth.length > 0) {
            // Auto-continue logic
            const newSelections = [...selectedServices];
            let addedcontinue = 0;
            continueTeeth.forEach(tooth => {
                const existingStage = activeStages.find(stage =>
                    stage.service_id === serviceId &&
                    stage.tooth_number === tooth
                );
                if (existingStage) {
                    const nextStage = existingStage.current_stage + 1;
                    if (nextStage > existingStage.total_stages) return;

                    const serviceUpdate = {
                        ...service,
                        benefit_cost: 0,
                        startAtStage: nextStage,
                        is_multi_stage_update: true,
                        related_bill_id: existingStage.related_bill_id,
                        stage_id: existingStage.id
                    };

                    // Check if already added
                    if (!newSelections.find(s => s.service.id === service.id && s.tooth_number === tooth)) {
                        newSelections.push({ service: serviceUpdate, tooth_number: tooth });
                        addedcontinue++;
                    }
                }
            });

            if (addedcontinue > 0) {
                setSelectedServices(newSelections);
                toast({ title: "Continuing Treatment", description: `Added next stage for ${addedcontinue} teeth.` });
            }

            // If all selected teeth were continuations, we are done.
            if (continueTeeth.length === selectedTeeth.length) {
                setSelectedTeeth([]);
                return;
            }

            // Otherwise, we might have mixed selection. 
            // But wait, performAddService will block the ones we just added? 
            // No, performAddService checks selectedTeeth. 
            // We should probably clear selection of handled teeth?
            // Or just let performAddService handle the "New" ones.
            // However, performAddService will block the ones that have active stages (which we just handled). 
            // So calling performAddService with ALL selectedTeeth is safe (it will block continueTeeth).
        }
    }

    // If we handled some continuations, we need to be careful not to double-add in performAddService.
    // Since performAddService reads current state, and we just called setSelectedServices (async), 
    // performAddService will NOT see our updates.
    // However, performAddService checks `activeStages` now (thanks to our previous edit).
    // So if we added a continuation because of an active stage, performAddService will BLOCK adding a "New Start" for that same tooth/service.
    // So it IS safe to fall through to performAddService!
    // So it IS safe to fall through to performAddService!

    // If it's a multi-stage service, prompt for stage selection for NEW starts
    if (service.is_multi_stage) {
        // Check if we already have an active stage for General (if no teeth selected)
        if (selectedTeeth.length === 0) {
            const existingStage = activeStages.find(stage =>
                stage.service_id === serviceId &&
                stage.tooth_number === null
            );
            if (existingStage) {
                const nextStage = existingStage.current_stage + 1;
                toast({ title: "Continuing Treatment", description: `Added ${service.name} Stage ${nextStage}.` });
                const serviceUpdate = {
                    ...service,
                    benefit_cost: 0,
                    startAtStage: nextStage,
                    is_multi_stage_update: true,
                    related_bill_id: existingStage.related_bill_id,
                    stage_id: existingStage.id
                };
                if (!selectedServices.find(s => s.service.id === serviceId && s.tooth_number === null)) {
                    setSelectedServices([...selectedServices, { service: serviceUpdate, tooth_number: null }]);
                }
                return;
            }
        }

        setPendingService(service);
        setStageDialogOpen(true);
        return;
    }

    performAddService(service, 1);
};

const handleConfirmStage = () => {
    if (pendingService) {
        performAddService(pendingService, selectedStageNumber);
        setStageDialogOpen(false);
        setPendingService(null);
    }
};

const handleContinueStage = (stage: any) => {
    if (selectedServices.find(s => s.service.stageId === stage.id)) {
        toast({ title: "Already Added", description: "This stage progression is already in the list.", variant: "secondary" });
        return;
    }
    setPendingContinueStage(stage);
    setStageNotes(""); // Reset notes
    setContinueStageDialogOpen(true);
};

const confirmContinueStage = () => {
    if (!pendingContinueStage) return;

    const stage = pendingContinueStage;
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
        isFinal: isFinal,
        notes: stageNotes // Attach notes
    };

    setSelectedServices([...selectedServices, { service: stageService, tooth_number: null }]);
    toast({ title: "Stage Added", description: `Scheduled completion of Stage ${nextStageNum}.` });

    setContinueStageDialogOpen(false);
    setPendingContinueStage(null);
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
            // Save treatment status / notes
            // Ideally we use RPC too but upsert might work for status since we are not changing condition?
            // But wait, `toothStatus` in Treatment mode is derived and includes 'in_progress'. 
            // We probably DON'T want to save 'in_progress' to DB permanently if it's computed from service_stages.
            // However, legacy logic did.
            // Let's rely on RPC for safety if we can.
            // But `upsert_dental_records` handles both.
            // Let's use RPC for robustness.

            const { error: dentalError } = await supabase.rpc('upsert_dental_records', { records: recordsToUpsert });
            if (dentalError) throw dentalError;
        }

        // Save Diagnosis if in Diagnosis Mode
        if (consultationMode === 'diagnosis') {
            const { error: diagnosisError } = await supabase.rpc('upsert_dental_records', {
                records: Object.entries(toothConditions).map(([t, c]) => ({
                    member_id: visit.member_id,
                    dependant_id: visit.dependant_id || null,
                    visit_id: visitId,
                    tooth_number: parseInt(t),
                    condition: c
                }))
            });
            if (diagnosisError) throw diagnosisError;
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

    // Check for existing visits for THIS PATIENT (Member or Dependant) today that are already billed
    let checkQuery = supabase
        .from("visits")
        .select("id")
        .eq("member_id", visit.member_id)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .neq("id", visitId)
        .in("status", ["billed", "completed"]);

    if (visit.dependant_id) {
        checkQuery = checkQuery.eq("dependant_id", visit.dependant_id);
    } else {
        checkQuery = checkQuery.is("dependant_id", null);
    }

    const { data: existingVisits, error: checkError } = await checkQuery;

    if (checkError) {
        toast({ title: "Error checking limits", description: checkError.message, variant: "destructive" });
        return;
    }

    if (existingVisits && existingVisits.length > 0) {
        toast({
            title: "Daily Limit Reached",
            description: `A visit has already been billed for this ${visit.dependant_id ? 'dependant' : 'member'} today. Only one billed visit per day is allowed.`,
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
            const { error: dentalError } = await supabase.rpc('upsert_dental_records', { records: recordsToUpsert });
            if (dentalError) throw dentalError;
        }

        // Split services into "New Multi-Stage" (Locked) and "Standard/Updates" (Unlocked/No-Cost)
        const newMultiStageServices = selectedServices.filter(s => s.service.is_multi_stage && !s.service.is_multi_stage_update);
        // "Standard" includes normal single-services AND multi-stage updates. 
        // Basically anything that is NOT a "New Multi-Stage Start".
        const standardAndUpdates = selectedServices.filter(s => !s.service.is_multi_stage || s.service.is_multi_stage_update);

        let primaryBillId = null;

        // 1. Handle Standard Bill (Unlocked) - Includes Updates (0 cost)
        if (standardAndUpdates.length > 0) {
            const totalBenefit = standardAndUpdates.reduce((acc, s) => acc + Number(s.service.benefit_cost || 0), 0);
            const totalCompensation = standardAndUpdates.reduce((acc, s) => acc + Number(s.service.branch_compensation || 0), 0);
            const totalReal = standardAndUpdates.reduce((acc, s) => acc + Number(s.service.real_cost || 0), 0);

            const { data: bill, error: billError } = await (supabase as any).from("bills").insert({
                visit_id: visitId,
                branch_id: doctorBranchId,
                member_id: visit.member_id,
                total_benefit_cost: totalBenefit,
                total_branch_compensation: totalCompensation,
                total_real_cost: totalReal,
                total_profit_loss: totalBenefit - totalCompensation,
                is_finalized: true,
                is_claimable: true,
                payment_status: 'pending'
            }).select().single();

            if (billError) throw billError;
            primaryBillId = bill.id;

            const itemsToInsert = standardAndUpdates.map(s => {
                let itemName = s.service.name;
                if (s.service.is_multi_stage_update) {
                    itemName += ` (Stage ${s.service.startAtStage})`; // startAtStage holds the target stage
                }

                return {
                    bill_id: bill.id,
                    service_id: s.service.id,
                    service_name: itemName,
                    quantity: 1,
                    unit_cost: s.service.benefit_cost || 0,
                    total_cost: s.service.benefit_cost || 0,
                    benefit_cost: s.service.benefit_cost || 0,
                    branch_compensation: s.service.branch_compensation || 0,
                    real_cost: s.service.real_cost || 0,
                    tooth_number: s.tooth_number ? s.tooth_number.toString() : null
                };
            });

            const { error: itemsError } = await (supabase as any).from("bill_items").insert(itemsToInsert as any);
            if (itemsError) throw itemsError;
        }

        // 2. Handle Locked Bill (New Multi-Stage Starts)
        if (newMultiStageServices.length > 0) {
            const totalBenefit = newMultiStageServices.reduce((acc, s) => acc + Number(s.service.benefit_cost || 0), 0);
            const totalCompensation = newMultiStageServices.reduce((acc, s) => acc + Number(s.service.branch_compensation || 0), 0);
            const totalReal = newMultiStageServices.reduce((acc, s) => acc + Number(s.service.real_cost || 0), 0);

            // Create a BILL for the full amount
            const { data: lockedBill, error: billError } = await (supabase as any).from("bills").insert({
                visit_id: visitId,
                branch_id: doctorBranchId,
                member_id: visit.member_id,
                total_benefit_cost: totalBenefit,
                total_branch_compensation: totalCompensation,
                total_real_cost: totalReal,
                total_profit_loss: totalBenefit - totalCompensation,
                is_finalized: true,
                is_claimable: false, // LOCKED - Not claimable by director yet
                payment_status: 'pending'
            }).select().single();

            if (billError) throw billError;
            if (!primaryBillId) primaryBillId = lockedBill.id;

            const itemsToInsert = newMultiStageServices.map(s => ({
                bill_id: lockedBill.id,
                service_id: s.service.id,
                service_name: s.service.name + " (Stage 1 - Full Payment)",
                quantity: 1,
                unit_cost: s.service.benefit_cost || 0,
                total_cost: s.service.benefit_cost || 0,
                benefit_cost: s.service.benefit_cost || 0,
                branch_compensation: s.service.branch_compensation || 0,
                real_cost: s.service.real_cost || 0,
                tooth_number: s.tooth_number ? s.tooth_number.toString() : null
            }));

            const { error: itemsError } = await (supabase as any).from("bill_items").insert(itemsToInsert as any);
            if (itemsError) throw itemsError;

            // Create Pending Claims (Locked Funds)
            for (const item of newMultiStageServices) {
                const { data: pendingClaim, error: claimError } = await (supabase as any).from("pending_claims").insert({
                    branch_id: doctorBranchId,
                    member_id: visit.member_id,
                    service_id: item.service.id,
                    visit_id: visitId,
                    bill_id: lockedBill.id,
                    locked_amount: item.service.branch_compensation || 0, // Lock the compensation amount
                    is_multi_stage: true,
                    status: 'locked',
                    released_to_director: false
                }).select().single();

                if (claimError) throw claimError;

                await supabase.from("service_stages").insert({
                    service_id: item.service.id,
                    member_id: visit.member_id,
                    dependant_id: visit.dependant_id || null,
                    visit_id: visitId,
                    tooth_number: item.tooth_number || null,
                    current_stage: 1,
                    selected_tooth: item.tooth_number || null, // Ensure selected_tooth is set
                    total_stages: item.service.total_stages,
                    status: 'in_progress',
                    related_bill_id: lockedBill.id,
                    pending_claim_id: pendingClaim.id, // Link to pending claim
                    notes: `Started in visit ${visitId} on tooth ${item.tooth_number}`
                });
            }
        }

        // 3. Handle Stage Updates (Create 0-cost bill for reception approval)
        const updates = selectedServices.filter(s => s.service.is_multi_stage_update);

        if (updates.length > 0) {
            // Create a bill for these updates so Receptionist can "Finalize" them
            // This ensures the flow is identical to other services
            const { data: updateBill, error: billError } = await (supabase as any).from("bills").insert({
                visit_id: visitId,
                branch_id: doctorBranchId,
                receptionist_id: null,
                status: 'pending',
                total_benefit_cost: 0,
                total_branch_compensation: 0,
                total_real_cost: 0,
                total_profit_loss: 0,
                is_finalized: false,
                is_claimable: false,
                payment_status: 'pending' // Pending receptionist finalization
            }).select().single();

            if (billError) throw billError;
            if (!primaryBillId) primaryBillId = updateBill.id;

            const updateItems = updates.map(s => ({
                bill_id: updateBill.id,
                service_id: s.service.id,
                service_name: s.service.name, // e.g. "Root Canal (Stage 2/3)"
                quantity: 1,
                unit_cost: 0,
                total_cost: 0,
                benefit_cost: 0,
                branch_compensation: 0,
                real_cost: 0,
                tooth_number: s.tooth_number ? s.tooth_number.toString() : null,
                notes: s.service.notes
            }));

            const { error: itemsError } = await (supabase as any).from("bill_items").insert(updateItems as any);
            if (itemsError) throw itemsError;
        }
        for (const item of updates) {
            const currentStage = item.service.startAtStage; // This holds the *next* stage
            const isFinal = currentStage === item.service.total_stages;

            const { error: stageUpdateError } = await (supabase as any)
                .from("service_stages")
                .update({
                    current_stage: currentStage,
                    status: isFinal ? 'completed' : 'in_progress',
                    updated_at: new Date().toISOString(),
                    visit_id: visitId,
                    notes: item.service.notes // Save notes here
                })
                .eq("id", item.service.stageId || item.service.stage_id);

            if (stageUpdateError) {
                console.error("Error updating service stage:", stageUpdateError);
                toast({
                    title: "Warning",
                    description: `Failed to update stage for ${item.service.name}. Please contact support.`,
                    variant: "destructive"
                });
                // Decide if we should throw to abort the whole transaction or continue. 
                // Given this is critical for the next visit, we should probably throw or at least alert loudly.
                // For now, let's throw to ensure data consistency (rollback bills if stage doesn't update).
                throw stageUpdateError;
            }

            if (isFinal) {
                // Trigger logic is handled by DB Trigger on service_stages update
                // But we can optionally notify or log here
                console.log("Final stage completed. Compensation should be unlocked via DB trigger.");

                if (item.service.related_bill_id) {
                    // Unlock the original bill (Legacy support or redundancy)
                    await (supabase as any)
                        .from("bills")
                        .update({ is_claimable: true })
                        .eq("id", item.service.related_bill_id);
                }
            }
        }

        // Only insert chart records if we have a bill ID or we can insert without it (check active stages for related bill)
        const chartRecordsToInsert = selectedServices
            .map(s => {
                let billIdToUse = primaryBillId;
                if (s.service.is_multi_stage_update && s.service.related_bill_id) {
                    billIdToUse = s.service.related_bill_id;
                }

                let toothNum = s.tooth_number ? s.tooth_number.toString() : null;

                // If stage update and no tooth selected, find it from active stage
                if (!toothNum && s.service.is_multi_stage_update) {
                    const relatedStage = activeStages.find(as => as.id === (s.service.stageId || s.service.stage_id));
                    if (relatedStage && relatedStage.tooth_number) {
                        toothNum = relatedStage.tooth_number.toString();
                    }
                }

                if (!toothNum) return null;

                return {
                    member_id: visit.member_id,
                    dependant_id: visit.dependant_id || null,
                    bill_id: billIdToUse,
                    service_id: s.service.id,
                    tooth_number: toothNum,
                    notes: s.service.notes || `Procedure performed on visit ${visitId}`,
                };
            })
            .filter(Boolean); // Remove nulls

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
            details: { visit_id: visitId, doctor_id: doctorId, services_count: selectedServices.length, bill_id: primaryBillId },
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
                                <div key={stage.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg border shadow-sm gap-4">
                                    <div>
                                        <div>
                                            <h4 className="font-bold text-foreground">{stage.services.name} {stage.tooth_number && <span className="text-sm font-normal text-muted-foreground">(Tooth #{stage.tooth_number})</span>}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Currently at <span className="font-medium text-blue-600">Stage {stage.current_stage}</span> of {stage.total_stages}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className={stage.current_stage + 1 === stage.total_stages ? "bg-green-600 hover:bg-green-700 w-full sm:w-auto" : "w-full sm:w-auto"}
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

                <Card className={cn("transition-all", consultationMode === 'diagnosis' ? "border-orange-200 bg-orange-50/30" : "")}>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <CardTitle>Dental Chart (FDI)</CardTitle>
                                    {consultationMode === 'diagnosis' ? (
                                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">
                                            Diagnosis Phase
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1">
                                            <Lock className="w-3 h-3" /> Treatment Phase
                                        </span>
                                    )}
                                </div>
                                <CardDescription>
                                    {consultationMode === 'diagnosis'
                                        ? "Mark tooth conditions. Lock detection to proceed to treatment."
                                        : "Select diagnosed teeth to add treatment services."}
                                </CardDescription>
                            </div>
                            <div className="flex gap-1 items-center">
                                {consultationMode === 'treatment' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs mr-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                                        onClick={() => setConsultationMode('diagnosis')}
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Add Diagnosis
                                    </Button>
                                )}
                                <div className="flex gap-1 bg-secondary/10 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                                    {chartMode === 'child' && <span>Pediatric Mode</span>}
                                    {chartMode === 'mixed' && <span>Mixed Dentition Mode (Pediatric)</span>}
                                    {chartMode === 'adult' && <span>Adult Mode</span>}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>

                        {/* Diagnosis Toolbar */}
                        {consultationMode === 'treatment' && !diagnosisLockedAt && (
                            <div className="mb-4 flex justify-end">
                                <Button variant="outline" size="sm" onClick={() => setConsultationMode('diagnosis')}>
                                    <Plus className="w-4 h-4 mr-2" /> Add/Edit Diagnosis
                                </Button>
                            </div>
                        )}

                        {consultationMode === 'diagnosis' && (
                            <div className="mb-6 p-4 bg-white rounded-xl border shadow-sm space-y-3">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Diagnosis Tools</Label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: 'decay', label: 'Decay', color: 'bg-red-500', border: 'border-red-200' },
                                        { id: 'missing', label: 'Missing', color: 'bg-yellow-400', border: 'border-yellow-200' },
                                        { id: 'filled', label: 'Filled', color: 'bg-green-500', border: 'border-green-200' },
                                        { id: 'crowned', label: 'Crowned', color: 'bg-blue-500', border: 'border-blue-200' },
                                        { id: 'partial_denture', label: 'Pt. Denture', color: 'bg-pink-500', border: 'border-pink-200' },
                                    ].map(tool => (
                                        <button
                                            key={tool.id}
                                            onClick={() => setSelectedDiagnosisTool(tool.id)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium",
                                                selectedDiagnosisTool === tool.id
                                                    ? "ring-2 ring-offset-1 ring-primary border-primary bg-secondary/20"
                                                    : "hover:bg-secondary/10 bg-white"
                                            )}
                                        >
                                            <div className={cn("w-4 h-4 rounded-full", tool.color)} />
                                            {tool.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t mt-2">
                                    <p className="text-xs text-muted-foreground">Mark all conditions then click Save to proceed to treatment.</p>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => saveDiagnosis()} disabled={submitting || Object.keys(toothConditions).length === 0} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
                                            <Save className="w-4 h-4 mr-2" /> Save Diagnosis
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <DentalChart
                            onToothClick={handleToothClick}
                            selectedTeeth={selectedTeeth}
                            toothStatus={toothStatus}
                            mode={chartMode}
                            readOnly={false} // Always interactive, but behavior changes
                            disabledTeeth={consultationMode === 'treatment'
                                ? [ // Generate array of all possible teeth
                                    18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
                                    48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
                                    55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
                                    85, 84, 83, 82, 81, 71, 72, 73, 74, 75
                                ].filter(id => !toothConditions[id]) // Disable if NOT in conditions
                                : []
                            }
                        />

                        {/* Service Selection (Treatment Mode Only) */}
                        {consultationMode === 'treatment' && selectedTeeth.length > 0 && (
                            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="p-5 border rounded-xl bg-blue-50/50 shadow-sm">
                                    <Label className="text-blue-900 font-bold mb-2 block">
                                        Add Procedure for Selected Teeth ({selectedTeeth.join(", ")})
                                    </Label>

                                    {/* Show Active Stages Hint */}
                                    {selectedTeeth.some(t => activeStages.some(s => s.tooth_number === t)) && (
                                        <div className="mb-3 text-xs bg-amber-100 text-amber-800 p-2 rounded border border-amber-200">
                                            <strong>Active Treatments:</strong>
                                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                                {selectedTeeth
                                                    .map(t => activeStages.find(s => s.tooth_number === t))
                                                    .filter(Boolean)
                                                    .map(s => (
                                                        <li key={s.id}>
                                                            Tooth {s.tooth_number}: {s.services?.name} - <strong>Stage {s.current_stage + 1}</strong> (Next)
                                                        </li>
                                                    ))
                                                }
                                            </ul>
                                        </div>
                                    )}
                                    <select
                                        className="flex h-11 w-full rounded-md border border-input bg-white px-3 py-2 text-sm mt-2 shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        onChange={(e) => {
                                            addService(e.target.value);
                                            e.target.value = "";
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select a procedure to perform on these teeth...</option>
                                        {availableServices.map(s => {
                                            // Check active stages
                                            const activeStagesForService = selectedTeeth.map(t =>
                                                activeStages.find(stage => stage.tooth_number === t && stage.service_id === s.id)
                                            ).filter(Boolean);

                                            const allActive = activeStagesForService.length === selectedTeeth.length;
                                            const anyActive = activeStagesForService.length > 0;

                                            // Check history/completed
                                            const anyCompleted = selectedTeeth.some(t =>
                                                serviceHistory.some(h => h.tooth_number === t && h.service_id === s.id)
                                            );

                                            if (anyCompleted) return null; // Hide if already done

                                            if (allActive) {
                                                // All selected teeth have this service active. Check next stage.
                                                // Assuming all are at same stage for simplicity, or taking the first one's next stage.
                                                // If we want to be robust, we'd check if they align.
                                                const currentStage = activeStagesForService[0]?.current_stage || 1;
                                                const totalStages = activeStagesForService[0]?.total_stages || 1;
                                                const nextStage = currentStage + 1;

                                                if (nextStage > totalStages) return null; // All done? Should catch in history check usually, but just in case.

                                                return (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} (Continue Stage {nextStage}) - Benefit: KES 0
                                                    </option>
                                                );
                                            }

                                            if (anyActive) {
                                                // Mixed state (some active, some not). Disable to prevent confusion.
                                                return (
                                                    <option key={s.id} value={s.id} disabled>
                                                        {s.name} (Mixed Status - Select Individually)
                                                    </option>
                                                );
                                            }

                                            // Default: New Start
                                            return (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} (Stage 1) - Benefit: KES {s.benefit_cost.toLocaleString()}
                                                </option>
                                            );
                                        })}
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
                                    <div key={`${s.service.id}-${index}`} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white gap-2">
                                        <div>
                                            <div className="font-semibold">{s.service.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {s.tooth_number ? <span className="font-bold text-primary mr-2">Tooth #{s.tooth_number}</span> : <span className="mr-2 italic">No tooth specified</span>}
                                                Benefit: KES {s.service.benefit_cost.toLocaleString()}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeService(index)} className="self-end sm:self-center">
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
                                    <span>KES {selectedServices.filter(s => !s.service.is_multi_stage_update).reduce((acc, s) => acc + Number(s.service.benefit_cost), 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-primary">
                                    <span>Estimated Coverage Deduction:</span>
                                    <span>KES {Math.min(selectedServices.filter(s => !s.service.is_multi_stage_update).reduce((acc, s) => acc + Number(s.service.benefit_cost), 0), visit.members.coverage_balance || 0).toLocaleString()}</span>
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

        <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Starting Stage</DialogTitle>
                    <DialogDescription>
                        "{pendingService?.name}" is a multi-stage procedure. Please select which stage you are performing today.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label>Current Stage</Label>
                    <Select
                        value={selectedStageNumber.toString()}
                        onValueChange={(val) => setSelectedStageNumber(parseInt(val))}
                    >
                        <SelectTrigger className="w-full mt-2">
                            <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                            {pendingService && Array.from({ length: pendingService.total_stages }, (_, i) => i + 1).map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                    Stage {num} of {pendingService.total_stages}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmStage}>Confirm & Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={continueStageDialogOpen} onOpenChange={setContinueStageDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Continue Treatment Stage</DialogTitle>
                    <DialogDescription>
                        Enter any treatment notes for this session.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Treatment Notes</Label>
                        <Textarea
                            placeholder="Describe the procedure details for this stage..."
                            value={stageNotes}
                            onChange={(e) => setStageNotes(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setContinueStageDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmContinueStage}>Confirm & Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
);
}