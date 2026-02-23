import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Save, Send, ArrowLeft, Trash2, Plus, AlertTriangle,
    Lock, Unlock, Image as ImageIcon, Upload, X, History, Camera,
    Stethoscope as DiagnosisIcon, ClipboardList, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DentalChart, DentalChartMode } from "@/components/doctor/DentalChart";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    const [periodontalStatus, setPeriodontalStatus] = useState<string | null>(null);
    const [xrayUrls, setXrayUrls] = useState<string[]>([]);
    const [isXrayModalOpen, setIsXrayModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [chartMode, setChartMode] = useState<DentalChartMode>('adult');

    // New State for Diagnosis/Treatment Separation
    const [consultationMode, setConsultationMode] = useState<'diagnosis' | 'treatment'>('diagnosis');
    const [diagnosisLockedAt, setDiagnosisLockedAt] = useState<string | null>(null);
    const [selectedDiagnosisTool, setSelectedDiagnosisTool] = useState<string>('decay'); // Default tool
    const [toothConditions, setToothConditions] = useState<Record<number, string>>({}); // status/condition map
    const [existingConditions, setExistingConditions] = useState<Record<number, boolean>>({}); // Lock map for historical data
    const [allMemberStages, setAllMemberStages] = useState<any[]>([]);
    const [pastVisits, setPastVisits] = useState<any[]>([]);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    const getMaxStageForSelection = (serviceId: string, teeth: number[]) => {
        const relevantStages = allMemberStages.filter(s =>
            s.service_id === serviceId &&
            (teeth.length === 0 ? s.tooth_number === null : teeth.includes(s.tooth_number))
        );
        if (relevantStages.length === 0) return 0;
        return Math.max(...relevantStages.map(s => s.current_stage));
    };



    const [activeStages, setActiveStages] = useState<any[]>([]);
    const [stageDialogOpen, setStageDialogOpen] = useState(false);
    const [pendingService, setPendingService] = useState<any>(null);
    const [selectedStageNumber, setSelectedStageNumber] = useState(1);

    const [stageNotes, setStageNotes] = useState("");
    const [continueStageDialogOpen, setContinueStageDialogOpen] = useState(false);
    const [pendingContinueStage, setPendingContinueStage] = useState<any>(null);

    const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
    const [pendingQuantityService, setPendingQuantityService] = useState<any>(null);
    const [serviceQuantity, setServiceQuantity] = useState(1);

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
            const visitData = data as any;
            setVisit(visitData);

            if ((visitData as any).diagnosis_locked_at) {
                setDiagnosisLockedAt((visitData as any).diagnosis_locked_at);
                setConsultationMode('treatment');
            } else {
                setConsultationMode('diagnosis');
            }

            // Fetch ALL multi-stage treatments to check history and progression
            let stagesQuery = (supabase as any)
                .from("service_stages")
                .select("*, services(name, stage_names, total_stages), tooth_number, related_bill_id")
                .eq("member_id", visitData.member_id);

            if (visitData.dependant_id) {
                stagesQuery = stagesQuery.eq("dependant_id", visitData.dependant_id);
            } else {
                stagesQuery = stagesQuery.is("dependant_id", null);
            }

            const { data: stages } = await stagesQuery;

            if (stages) {
                const stagesArray = stages as any[];
                // Store active ones for auto-continuation
                setActiveStages(stagesArray.filter(s => s.status === 'in_progress'));
                // Store everything for progression checks
                setAllMemberStages(stagesArray);
            }

            // Fetch past visits with X-rays and stages
            const { data: visitsData } = await supabase
                .from("visits")
                .select(`
                    id, 
                    created_at, 
                    diagnosis, 
                    treatment_notes, 
                    xray_urls, 
                    status,
                    doctor:doctor_id(full_name),
                    branches(name),
                    service_stages(*)
                `)
                .eq("member_id", data.member_id)
                .neq("id", visitId) // Exclude current visit
                .order("created_at", { ascending: false });

            if (visitsData) setPastVisits(visitsData);

            let recordsQuery = supabase
                .from("dental_records")
                .select("tooth_number, status, condition, color, visit_id")
                .eq("member_id", data.member_id);

            if (data.dependant_id) {
                recordsQuery = recordsQuery.eq("dependant_id", data.dependant_id);
            } else {
                recordsQuery = recordsQuery.is("dependant_id", null);
            }

            const { data: records, error: recordsError } = await recordsQuery;

            if (records) {
                const conditions: Record<number, string> = {};
                const history: Record<number, boolean> = {};

                records.forEach((r: any) => {
                    if (r.condition) conditions[r.tooth_number] = r.condition;
                    else if (r.status) conditions[r.tooth_number] = r.status;

                    // If record is from a DIFFERENT visit OR if diagnosis was previously locked in this visit
                    if (r.visit_id !== visitId || data.diagnosis_locked_at) {
                        history[r.tooth_number] = true;
                    }
                });
                setToothConditions(conditions);
                setExistingConditions(history);

                // Auto-switch to treatment mode only if specifically locked
                if (data.diagnosis_locked_at) {
                    setConsultationMode('treatment');
                } else {
                    setConsultationMode('diagnosis');
                }

                // For display in Treatment Mode, we want to overlay treatment status (e.g. in_progress)
                // But keep underlying condition visible if not hidden?
                // DentalChart takes a single status.
                // We will compute `toothStatus` derived state during render or use effect.
            }

            let historyQuery = supabase
                .from("dental_chart_records")
                .select("tooth_number, service_id, created_at")
                .eq("member_id", data.member_id);

            if (data.dependant_id) {
                historyQuery = historyQuery.eq("dependant_id", data.dependant_id);
            } else {
                historyQuery = historyQuery.is("dependant_id", null);
            }

            const { data: history } = await historyQuery;

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
            // Check if tooth has active multi-stage treatment
            const activeStage = activeStages.find(s => s.tooth_number === toothId);
            if (activeStage) {
                toast({
                    title: "Active Treatment",
                    description: `Tooth #${toothId} is currently undergoing ${activeStage.services.name}. You cannot re-diagnose or add new treatments until it is completed.`,
                    variant: "destructive"
                });
                return;
            }

            // Check if tooth has historical diagnosis or locked in current session
            if (existingConditions[toothId]) {
                toast({
                    title: "Diagnosis Locked",
                    description: "This condition has already been saved/finalized and cannot be modified. You can still diagnose other unmarked teeth.",
                    variant: "default"
                });
                return;
            }

            // Allow editing even if previously saved in this visit.
            // Explicit locking only happens in Treatment Mode.
            // User request: "allow editing... lock editing only after a save diagnosis button is clicked"
            // We interpret "lock" as "stopping the doctor from toggling while in treatment mode"
            // and "save" as the trigger to persist to DB.


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
            const activeStage = activeStages.find(s => s.tooth_number === toothId);
            if (activeStage) {
                toast({
                    title: "Ongoing Treatment",
                    description: `Tooth #${toothId} has an ongoing ${activeStage.services.name}. Use the "Ongoing Treatments" panel to progress stages.`,
                    variant: "destructive"
                });
                return;
            }

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
                const { error: dentalError } = await (supabase as any).rpc('upsert_dental_records', { records: recordsToUpsert });
                if (dentalError) throw dentalError;
            }

            // Update visit diagnosis text and "lock" it (mark as passed diagnosis)
            const { error: visitError } = await supabase.from("visits").update({
                diagnosis: diagnosis,
                treatment_notes: treatmentNotes,
                periodontal_status: periodontalStatus,
                xray_urls: xrayUrls,
                diagnosis_locked_at: new Date().toISOString() // We still track this for state persistence
            }).eq("id", visitId);

            if (visitError) throw visitError;

            // Save X-rays to the new structured table
            if (xrayUrls.length > 0) {
                const xraysToInsert = xrayUrls.map(url => ({
                    member_id: visit.member_id,
                    doctor_id: doctorId,
                    visit_id: visitId,
                    diagnosis_id: visitId, // Using visitId as diagnosis_id
                    image_url: url,
                    uploaded_at: new Date().toISOString()
                }));
                const { error: xrayError } = await (supabase as any).from("patient_xrays").insert(xraysToInsert);
                if (xrayError) throw xrayError;
            }

            toast({
                title: "Diagnosis Saved",
                description: "Moving to treatment phase."
            });

            setDiagnosisLockedAt(new Date().toISOString());

            // Lock the teeth currently in toothConditions so they can't be toggled anymore
            const newLockedHistory = { ...existingConditions };
            Object.keys(toothConditions).forEach(tn => {
                newLockedHistory[parseInt(tn)] = true;
            });
            setExistingConditions(newLockedHistory);

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
        // Scaling Restriction: Must have periodontal status
        const scalingNames = ["scaling", "polishing", "scaling and polishing"];
        const isScaling = scalingNames.some(name => service.name.toLowerCase().includes(name));

        if (isScaling && !periodontalStatus) {
            toast({
                title: "Diagnosis Required",
                description: "You must select a periodontal status (Staining, Calculus, Gingivitis, or Periodontitis) before adding Scaling services.",
                variant: "destructive"
            });
            return;
        }

        if (selectedTeeth.length > 0) {
            let addedCount = 0;
            const newSelections = [...selectedServices];
            const blockedTeeth: number[] = [];

            selectedTeeth.forEach(tooth => {
                if (newSelections.find(s => s.service.id === service.id && s.tooth_number === tooth)) {
                    return;
                }

                // 1. Check History: For non-multi-stage, block if already done EVER on this tooth
                const hasExistingRecord = !service.is_multi_stage && serviceHistory.some(h =>
                    h.tooth_number == tooth && h.service_id === service.id
                );

                // 2. Check Active: Is ANY stage already in progress?
                const isAnyStageActive = activeStages.some(as =>
                    as.tooth_number === tooth &&
                    as.service_id === service.id &&
                    as.status === 'in_progress'
                );

                // 3. Multi-stage progression check
                const maxDone = getMaxStageForSelection(service.id, [tooth]);
                const isServiceMultiStage = service.is_multi_stage || (service.total_stages && service.total_stages > 1);

                if (isAnyStageActive) {
                    blockedTeeth.push(tooth);
                } else if (!isServiceMultiStage && hasExistingRecord) {
                    blockedTeeth.push(tooth);
                } else if (isServiceMultiStage && startStage <= maxDone) {
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
                    title: "Action Restricted",
                    description: `One or more teeth are blocked for ${service.name} (Stage ${startStage}). You may have already performed this stage or it is currently active.`,
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

        // Pins and Posts Logic: Multi-unit service
        const isPinsAndPosts = service.name.toLowerCase().includes("pins") && service.name.toLowerCase().includes("posts");
        if (isPinsAndPosts) {
            setPendingQuantityService(service);
            setServiceQuantity(1);
            setQuantityDialogOpen(true);
            return;
        }

        let teethToProcess = [...selectedTeeth];

        // 1. Check active stages to auto-continue existing treatments
        if (teethToProcess.length > 0) {
            const continueTeeth = teethToProcess.filter(tooth =>
                activeStages.some(stage => stage.service_id === serviceId && stage.tooth_number === tooth)
            );

            if (continueTeeth.length > 0) {
                const newSelections = [...selectedServices];
                let addedcontinue = 0;
                continueTeeth.forEach(tooth => {
                    const existingStage = activeStages.find(stage =>
                        stage.service_id === serviceId &&
                        stage.tooth_number === tooth
                    );
                    if (existingStage) {
                        const nextStage = existingStage.current_stage + 1;
                        if (nextStage <= existingStage.total_stages) {
                            const serviceUpdate = {
                                ...service,
                                benefit_cost: 0,
                                startAtStage: nextStage,
                                is_multi_stage: true,
                                is_multi_stage_update: true,
                                related_bill_id: existingStage.related_bill_id,
                                stage_id: existingStage.id,
                                total_stages: service.total_stages || existingStage.total_stages
                            };
                            if (!newSelections.find(s => s.service.id === service.id && s.tooth_number === tooth)) {
                                newSelections.push({ service: serviceUpdate, tooth_number: tooth });
                                addedcontinue++;
                            }
                        }
                    }
                });

                if (addedcontinue > 0) {
                    setSelectedServices(newSelections);
                    toast({ title: "Continuing Treatment", description: `Added next stage for ${addedcontinue} teeth.` });
                }

                // Remove handled teeth from the list
                teethToProcess = teethToProcess.filter(t => !continueTeeth.includes(t));

                if (teethToProcess.length === 0) {
                    setSelectedTeeth([]);
                    return;
                }
            }
        }

        // If it's a multi-stage service, prompt for stage selection for NEW starts
        const isMultiStage = service.is_multi_stage || (service.total_stages && service.total_stages > 1);
        if (isMultiStage) {
            // Check if we already have an active stage for General (if no teeth selected)
            if (teethToProcess.length === 0) {
                const existingStage = activeStages.find(stage =>
                    stage.service_id === serviceId &&
                    stage.tooth_number === null
                );
                if (existingStage) {
                    const nextStage = existingStage.current_stage + 1;
                    if (nextStage > service.total_stages) {
                        toast({ title: "Completed", description: "This treatment is already completed.", variant: "default" });
                        return;
                    }
                    toast({ title: "Continuing Treatment", description: `Added ${service.name} Stage ${nextStage}.` });
                    const serviceUpdate = {
                        ...service,
                        benefit_cost: 0,
                        startAtStage: nextStage,
                        is_multi_stage: true,
                        is_multi_stage_update: true,
                        related_bill_id: existingStage.related_bill_id,
                        stage_id: existingStage.id,
                        total_stages: service.total_stages || existingStage.total_stages
                    };
                    if (!selectedServices.find(s => s.service.id === serviceId && s.tooth_number === null)) {
                        setSelectedServices([...selectedServices, { service: serviceUpdate, tooth_number: null }]);
                    }
                    return;
                }
            }

            // Set default stage to next available
            const maxStage = getMaxStageForSelection(service.id, teethToProcess);
            const nextSuggested = maxStage + 1;

            if (nextSuggested > service.total_stages) {
                toast({
                    title: "Service Completed",
                    description: `All ${service.total_stages} stages of this service have already been recorded for these teeth.`,
                    variant: "destructive"
                });
                return;
            }

            setPendingService(service);
            setSelectedStageNumber(nextSuggested);
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
            toast({ title: "Already Added", description: "This stage progression is already in the list.", variant: "default" });
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
            name: stage.services?.name || 'Treatment', // Use base name
            benefit_cost: 0, // No charge for subsequent stages
            branch_compensation: 0,
            real_cost: 0,
            is_multi_stage: true,
            is_multi_stage_update: true,
            startAtStage: nextStageNum, // CRITICAL: handleFinalize expects this for updating the DB
            total_stages: stage.total_stages,
            stage_names: stage.services?.stage_names || [], // Keep the names
            stageId: stage.id,
            nextStage: nextStageNum,
            isFinal: isFinal,
            notes: stageNotes // Attach notes
        };

        setSelectedServices([...selectedServices, { service: stageService, tooth_number: stage.tooth_number }]);
        toast({ title: "Stage Added", description: `Scheduled completion of Stage ${nextStageNum}.` });

        setContinueStageDialogOpen(false);
        setPendingContinueStage(null);
    };

    const handleConfirmQuantity = () => {
        if (!pendingQuantityService) return;
        const serviceWithQuantity = {
            ...pendingQuantityService,
            quantity: serviceQuantity
        };
        performAddService(serviceWithQuantity);
        setQuantityDialogOpen(false);
        setPendingQuantityService(null);
        setServiceQuantity(1);
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
                periodontal_status: periodontalStatus,
                xray_urls: xrayUrls
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

                const { error: dentalError } = await (supabase as any).rpc('upsert_dental_records', { records: recordsToUpsert });
                if (dentalError) throw dentalError;
            }

            // Removed autosave of dental records here to allow free editing until explicit "Save Diagnosis".
            // Draft saving now only focuses on Clinical Notes (visits table).


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
                condition: toothConditions[parseInt(tooth_number)] || null, // Preserve condition
                notes: `Updated in visit ${visitId}`
            }));

            if (recordsToUpsert.length > 0) {
                const { error: dentalError } = await (supabase as any).rpc('upsert_dental_records', { records: recordsToUpsert });
                if (dentalError) throw dentalError;
            }

            // Split services into "New Multi-Stage" (Locked) and "Standard/Updates" (Unlocked/No-Cost)
            const newMultiStageServices = selectedServices.filter(s => {
                const isMS = s.service.is_multi_stage || (s.service.total_stages && s.service.total_stages > 1);
                return isMS && !s.service.is_multi_stage_update;
            });
            // "Standard" includes normal single-services AND multi-stage updates. 
            // Basically anything that is NOT a "New Multi-Stage Start".
            const standardAndUpdates = selectedServices.filter(s => {
                const isMS = s.service.is_multi_stage || (s.service.total_stages && s.service.total_stages > 1);
                return !isMS || s.service.is_multi_stage_update;
            });

            let primaryBillId = null;

            // 1. Handle Standard Bill (Unlocked) - Includes Updates (0 cost)
            if (standardAndUpdates.length > 0) {
                const totalBenefit = standardAndUpdates.reduce((acc, s) => acc + (Number(s.service.benefit_cost || 0) * (s.service.quantity || 1)), 0);
                const totalCompensation = standardAndUpdates.reduce((acc, s) => acc + (Number(s.service.branch_compensation || 0) * (s.service.quantity || 1)), 0);
                const totalReal = standardAndUpdates.reduce((acc, s) => acc + (Number(s.service.real_cost || 0) * (s.service.quantity || 1)), 0);

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
                    const qty = s.service.quantity || 1;
                    let itemName = s.service.name;
                    if (s.service.is_multi_stage_update) {
                        const currentStage = s.service.startAtStage;
                        const stageName = s.service.stage_names?.[currentStage - 1];
                        itemName += ` (Stage ${currentStage}/${s.service.total_stages || '?'}${stageName ? `: ${stageName}` : ''})`;
                    } else if (qty > 1) {
                        itemName += ` (x${qty})`;
                    }

                    return {
                        bill_id: bill.id,
                        service_id: s.service.id,
                        service_name: itemName,
                        quantity: qty,
                        unit_cost: s.service.benefit_cost || 0,
                        total_cost: (s.service.benefit_cost || 0) * qty,
                        benefit_cost: (s.service.benefit_cost || 0) * qty,
                        branch_compensation: (s.service.branch_compensation || 0) * qty,
                        real_cost: (s.service.real_cost || 0) * qty,
                        tooth_number: s.tooth_number ? s.tooth_number.toString() : null
                    };
                });

                const { error: itemsError } = await (supabase as any).from("bill_items").insert(itemsToInsert as any);
                if (itemsError) throw itemsError;
            }

            // 2. Handle Locked Bill (New Multi-Stage Starts)
            if (newMultiStageServices.length > 0) {
                const totalBenefit = newMultiStageServices.reduce((acc, s) => acc + (Number(s.service.benefit_cost || 0) * (s.service.quantity || 1)), 0);
                const totalCompensation = newMultiStageServices.reduce((acc, s) => acc + (Number(s.service.branch_compensation || 0) * (s.service.quantity || 1)), 0);
                const totalReal = newMultiStageServices.reduce((acc, s) => acc + (Number(s.service.real_cost || 0) * (s.service.quantity || 1)), 0);

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

                const itemsToInsert = newMultiStageServices.map(s => {
                    const qty = s.service.quantity || 1;
                    const curStage = s.service.startAtStage || 1;
                    const stageName = s.service.stage_names?.[curStage - 1];
                    const suffix = curStage === 1 ? " - Full Payment" : "";

                    return {
                        bill_id: lockedBill.id,
                        service_id: s.service.id,
                        service_name: `${s.service.name} (Stage ${curStage}${stageName ? `: ${stageName}` : ''}${suffix})${qty > 1 ? ` (x${qty})` : ""}`,
                        quantity: qty,
                        unit_cost: s.service.benefit_cost || 0,
                        total_cost: (s.service.benefit_cost || 0) * qty,
                        benefit_cost: (s.service.benefit_cost || 0) * qty,
                        branch_compensation: (s.service.branch_compensation || 0) * qty,
                        real_cost: (s.service.real_cost || 0) * qty,
                        tooth_number: s.tooth_number ? s.tooth_number.toString() : null
                    };
                });

                const { error: itemsError } = await (supabase as any).from("bill_items").insert(itemsToInsert as any);
                if (itemsError) throw itemsError;

                // Create Pending Claims (Locked Funds)
                for (const item of newMultiStageServices) {
                    const { data: pendingClaim, error: claimError } = await (supabase as any).from("pending_claims").insert({
                        branch_id: doctorBranchId,
                        member_id: visit.member_id,
                        service_id: item.service.id,
                        visit_id: visitId,
                        bill_id: (lockedBill as any).id,
                        locked_amount: (item.service.branch_compensation || 0) * (item.service.quantity || 1), // Lock the total compensation amount
                        is_multi_stage: true,
                        status: 'locked',
                        released_to_director: false
                    }).select().single();

                    if (claimError) throw claimError;

                    await (supabase as any).from("service_stages").insert({
                        service_id: item.service.id,
                        member_id: visit.member_id,
                        dependant_id: visit.dependant_id || null,
                        visit_id: visitId,
                        tooth_number: item.tooth_number || null,
                        current_stage: item.service.startAtStage || 1,
                        selected_tooth: item.tooth_number || null, // Ensure selected_tooth is set
                        total_stages: item.service.total_stages || 1,
                        status: 'in_progress',
                        related_bill_id: (lockedBill as any).id,
                        pending_claim_id: (pendingClaim as any).id, // Link to pending claim
                        notes: `Started in visit ${visitId} on tooth ${item.tooth_number}`
                    });

                    // Audit Log for Start
                    await (supabase as any).from("system_logs").insert({
                        action: "multi_stage_service_started",
                        details: {
                            tooth_id: item.tooth_number,
                            service_id: item.service.id,
                            service_name: item.service.name,
                            doctor_id: doctorId,
                            visit_id: visitId
                        }
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
                        title: "Treatment in Progress",
                        description: `You are currently continuing ${item.service?.name || 'this service'} for Stage ${currentStage}.`,
                        variant: "default"
                    });
                    throw stageUpdateError;
                }

                // Audit Log for Completion/Progression
                await (supabase as any).from("system_logs").insert({
                    action: isFinal ? "multi_stage_service_completed" : "multi_stage_stage_completed",
                    details: {
                        tooth_id: item.tooth_number,
                        service_id: item.service.id,
                        service_name: item.service.name,
                        current_stage: currentStage,
                        total_stages: item.service.total_stages,
                        doctor_id: doctorId,
                        notes: item.service.notes
                    }
                });

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
                        <div className="flex items-center gap-3">
                            <p className="text-muted-foreground">Visit #{visitId?.slice(0, 8)} • ID: {visit.dependants?.document_number || visit.members.id_number || 'N/A'} • Age: {patientAge} yrs</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] uppercase font-bold tracking-wider border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100"
                                onClick={() => setIsHistoryDialogOpen(true)}
                            >
                                <History className="w-3 h-3 mr-1" />
                                View Clinical History
                            </Button>
                        </div>
                        {visit.dependants && (
                            <p className="text-sm text-muted-foreground">Principal Member: <span className="font-medium text-foreground">{visit.members.full_name}</span> ({visit.members.member_number})</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {activeStages.length > 0 && (
                        <Card className="border-blue-300 bg-blue-50/80 shadow-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-blue-900 flex items-center gap-2 text-xl">
                                    <History className="h-6 w-6" />
                                    Ongoing Session Treatments
                                </CardTitle>
                                <CardDescription className="text-blue-700 font-medium">Continue progressing ongoing procedures for this patient.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeStages.map(stage => {
                                    const progress = (stage.current_stage / stage.total_stages) * 100;
                                    const isAlreadyAdded = selectedServices.some(s => s.service.stage_id === stage.id || s.service.stageId === stage.id);
                                    const nextStage = stage.current_stage < stage.total_stages ? stage.current_stage + 1 : stage.current_stage;

                                    return (
                                        <div key={stage.id} className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-lg text-slate-900">{stage.services?.name || 'Ongoing Procedure'}</h4>
                                                        <Badge className="bg-blue-600">Tooth #{stage.tooth_number || 'General'}</Badge>
                                                    </div>
                                                    <p className="text-sm text-slate-600 font-medium italic">
                                                        Last recorded progress: Stage {stage.current_stage} of {stage.total_stages || stage.services?.total_stages || '?'}
                                                        {stage.services?.stage_names?.[stage.current_stage - 1] && ` (${stage.services.stage_names[stage.current_stage - 1]})`}
                                                    </p>
                                                </div>

                                                {!isAlreadyAdded ? (
                                                    <Button
                                                        size="lg"
                                                        className="bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-lg gap-2"
                                                        onClick={() => handleContinueStage(stage)}
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                        Complete Stage {nextStage} {stage.services?.stage_names?.[nextStage - 1] && ` (${stage.services.stage_names[nextStage - 1]})`}
                                                    </Button>
                                                ) : (
                                                    <Badge variant="outline" className="h-10 px-4 text-emerald-700 bg-emerald-50 border-emerald-200 font-bold gap-2">
                                                        <CheckCircle2 className="w-4 h-4" /> Ready for Finalization
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-blue-900 uppercase">
                                                    <span>Progression</span>
                                                    <span>{Math.round(progress)}% Complete</span>
                                                </div>
                                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border">
                                                    <div
                                                        className="h-full bg-blue-600 transition-all duration-500"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
                            {consultationMode === 'treatment' && (
                                <div className="mb-4 flex justify-end">
                                    <Button variant="outline" size="sm" onClick={() => setConsultationMode('diagnosis')}>
                                        <Plus className="w-4 h-4 mr-2" /> Add/Edit Diagnosis
                                    </Button>
                                </div>
                            )}

                            {consultationMode === 'diagnosis' && (
                                <div className="space-y-6">
                                    <div className="p-4 bg-white rounded-xl border shadow-sm space-y-3">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Diagnosis Tools</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'decay', label: 'Decay', color: 'bg-red-700', border: 'border-red-300' },
                                                { id: 'missing', label: 'Missing', color: 'bg-amber-600', border: 'border-amber-200' },
                                                { id: 'filled', label: 'Filled', color: 'bg-emerald-700', border: 'border-emerald-300' },
                                                { id: 'crowned', label: 'Crowned', color: 'bg-blue-800', border: 'border-blue-300' },
                                                { id: 'partial_denture', label: 'Pt. Denture', color: 'bg-fuchsia-700', border: 'border-fuchsia-300' },
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
                                                <Button type="button" variant="outline" size="sm" onClick={() => setIsXrayModalOpen(true)} className="border-blue-200 text-blue-700 bg-blue-50/50">
                                                    <ImageIcon className="w-4 h-4 mr-2" /> X-Rays ({xrayUrls.length})
                                                </Button>
                                                <Button size="sm" onClick={() => saveDiagnosis()} disabled={submitting || (Object.keys(toothConditions).length === 0 && !periodontalStatus)} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
                                                    <Save className="w-4 h-4 mr-2" /> Save Diagnosis
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Separate X-Ray Upload Section - In Diagnosis Phase */}
                                    <div className="p-4 bg-white rounded-xl border shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Upload X-Ray Images</Label>
                                            {diagnosisLockedAt && <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50">Locked</Badge>}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {xrayUrls.map((url, idx) => (
                                                <div key={idx} className="relative group w-16 h-16 rounded border overflow-hidden bg-slate-50">
                                                    <img src={url} alt="X-ray" className="w-full h-full object-cover" />
                                                    {!diagnosisLockedAt && (
                                                        <button
                                                            onClick={() => setXrayUrls(xrayUrls.filter((_, i) => i !== idx))}
                                                            className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <label className={cn(
                                                "w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer transition-colors",
                                                diagnosisLockedAt
                                                    ? "opacity-50 cursor-not-allowed border-slate-200"
                                                    : "border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                                            )}>
                                                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Upload className="w-4 h-4 text-slate-400" />}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,.pdf"
                                                    disabled={uploading || !!diagnosisLockedAt}
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        setUploading(true);
                                                        try {
                                                            const fileExt = file.name.split('.').pop();
                                                            const fileName = `${visitId}/${Math.random()}.${fileExt}`;
                                                            const filePath = `x-rays/${fileName}`;

                                                            const { error: uploadError } = await supabase.storage
                                                                .from('medical-records')
                                                                .upload(filePath, file);

                                                            if (uploadError) throw uploadError;

                                                            const { data: { publicUrl } } = supabase.storage
                                                                .from('medical-records')
                                                                .getPublicUrl(filePath);

                                                            setXrayUrls([...xrayUrls, publicUrl]);
                                                        } catch (error: any) {
                                                            toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
                                                        } finally {
                                                            setUploading(false);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Periodontal Status Selection - Only in Diagnosis Phase */}
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 block">Periodontal Status</Label>
                                        <RadioGroup
                                            value={periodontalStatus || ""}
                                            onValueChange={setPeriodontalStatus}
                                            className="flex flex-wrap gap-4"
                                        >
                                            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                                <RadioGroupItem value="staining" id="staining" />
                                                <Label htmlFor="staining" className="cursor-pointer">Staining</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                                <RadioGroupItem value="calculus" id="calculus" />
                                                <Label htmlFor="calculus" className="cursor-pointer">Calculus</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                                <RadioGroupItem value="periodontitis" id="periodontitis" />
                                                <Label htmlFor="periodontitis" className="cursor-pointer">Periodontitis</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                                <RadioGroupItem value="gingivitis" id="gingivitis" />
                                                <Label htmlFor="gingivitis" className="cursor-pointer">Gingivitis</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </div>
                            )}

                            <DentalChart
                                onToothClick={handleToothClick}
                                selectedTeeth={selectedTeeth}
                                toothStatus={toothStatus}
                                toothStages={(() => {
                                    const stages: Record<number, { current: number, total: number }> = {};
                                    // Add existing active stages
                                    activeStages.forEach(s => {
                                        if (s.tooth_number) {
                                            stages[s.tooth_number] = { current: s.current_stage, total: s.total_stages };
                                        }
                                    });
                                    // Override with session selections (if incrementing or starting)
                                    selectedServices.forEach(s => {
                                        if (s.tooth_number && s.service.is_multi_stage) {
                                            stages[s.tooth_number] = {
                                                current: s.service.startAtStage || 1,
                                                total: s.service.total_stages
                                            };
                                        }
                                    });
                                    return stages;
                                })()}
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
                                            <div className="mb-4 space-y-2">
                                                {selectedTeeth.map(t => {
                                                    const stage = activeStages.find(s => s.tooth_number === t);
                                                    if (!stage) return null;
                                                    return (
                                                        <div key={stage.id} className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                <span className="font-bold text-amber-900">Tooth {t}:</span>
                                                                <span className="text-amber-800">{stage.services?.name}</span>
                                                            </div>
                                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 font-bold">
                                                                Stage {stage.current_stage} Completed
                                                            </Badge>
                                                        </div>
                                                    );
                                                })}
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
                                                const isScaling = ["scaling", "polishing", "scaling and polishing"].some(name => s.name.toLowerCase().includes(name));
                                                const isDisabled = isScaling && !periodontalStatus;
                                                return (
                                                    <option key={s.id} value={s.id} disabled={isDisabled}>
                                                        {s.name} (Benefit: KES {s.benefit_cost.toLocaleString()}) {isDisabled ? ' - Select Periodontal Status first' : ''}
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
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold">{s.service.name}</div>
                                                    {(s.service.is_multi_stage || (s.service.total_stages && s.service.total_stages > 1)) && (
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                                                            Stage {s.service.startAtStage || 1} of {s.service.total_stages || '?'}
                                                            {s.service.stage_names?.[(s.service.startAtStage || 1) - 1] && ` — ${s.service.stage_names[(s.service.startAtStage || 1) - 1]}`}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {s.tooth_number ? <span className="font-bold text-primary mr-2">Tooth #{s.tooth_number}</span> : <span className="mr-2 italic">No tooth specified</span>}
                                                    {s.service.quantity > 1 ? (
                                                        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-slate-300">Qty: {s.service.quantity}</Badge>
                                                            <span>Benefit: KES {(s.service.benefit_cost * s.service.quantity).toLocaleString()} <span className="text-[10px] opacity-60">(KES {s.service.benefit_cost.toLocaleString()} / unit)</span></span>
                                                        </span>
                                                    ) : (
                                                        <span>Benefit: KES {s.service.benefit_cost.toLocaleString()}</span>
                                                    )}
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
                    {/* Active Treatments Progress */}
                    {activeStages.length > 0 && (
                        <Card className="border-blue-200 bg-blue-50/30">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                                    <History className="w-4 h-4" />
                                    Active Treatments
                                </CardTitle>
                                <CardDescription className="text-[10px] text-blue-700">Currently in progress for this member</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {activeStages.map((stage) => (
                                        <div key={stage.id} className="text-xs p-2 bg-white rounded border border-blue-100 flex justify-between items-center shadow-sm">
                                            <div>
                                                <div className="font-semibold text-blue-900">
                                                    {stage.tooth_number ? `Tooth ${stage.tooth_number}` : 'General'}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                    {stage.services?.name}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <Badge className="text-[10px] px-1 py-0 h-5 bg-blue-600">
                                                    Stage {stage.current_stage} of {stage.total_stages}
                                                    {stage.services?.stage_names?.[stage.current_stage - 1] && ` — ${stage.services.stage_names[stage.current_stage - 1]}`}
                                                </Badge>
                                                {stage.current_stage < stage.total_stages ? (
                                                    <span className="text-[9px] text-blue-500 mt-1 font-medium">
                                                        Awaiting Stage {stage.current_stage + 1}
                                                        {stage.services?.stage_names?.[stage.current_stage] && ` (${stage.services.stage_names[stage.current_stage]})`}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] text-emerald-600 mt-1 font-bold">
                                                        Final Session Soon
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                                {pendingService && Array.from({ length: pendingService.total_stages }, (_, i) => i + 1)
                                    .filter(num => num > getMaxStageForSelection(pendingService.id, selectedTeeth))
                                    .map((num) => (
                                        <SelectItem key={num} value={num.toString()}>
                                            Stage {num} of {pendingService.total_stages} {pendingService.stage_names?.[num - 1] && ` — ${pendingService.stage_names[num - 1]}`}
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
                            {pendingContinueStage?.services?.stage_names?.[pendingContinueStage.current_stage] && (
                                <div className="mt-2 font-bold text-blue-700">
                                    Next: Stage {pendingContinueStage.current_stage + 1} — {pendingContinueStage.services.stage_names[pendingContinueStage.current_stage]}
                                </div>
                            )}
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
            <Dialog open={quantityDialogOpen} onOpenChange={setQuantityDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enter Quantity</DialogTitle>
                        <DialogDescription>
                            Specify the number of units for <strong>{pendingQuantityService?.name}</strong>.
                            Total cost will be calculated automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Number of Units (Pins/Posts)</Label>
                            <Input
                                type="number"
                                min="1"
                                max="10"
                                value={serviceQuantity}
                                onChange={(e) => setServiceQuantity(parseInt(e.target.value) || 1)}
                            />
                        </div>
                        {pendingQuantityService && (
                            <div className="p-3 bg-slate-50 rounded-lg border text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span>Unit Cost:</span>
                                    <span>KES {pendingQuantityService.benefit_cost.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-primary">
                                    <span>Total Benefit Cost:</span>
                                    <span>KES {(pendingQuantityService.benefit_cost * serviceQuantity).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuantityDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmQuantity}>Add Service</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Clinical History Dialog */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="w-5 h-5 text-primary" />
                            Clinical History - {patientName}
                        </DialogTitle>
                        <DialogDescription>Previous visits, diagnoses, and medical records.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        {pastVisits.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl">
                                <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No previous clinical history found.</p>
                            </div>
                        ) : (
                            pastVisits.map((v) => (
                                <Card key={v.id} className="border-slate-200 shadow-sm overflow-hidden">
                                    <CardHeader className="bg-slate-50/50 py-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-white">{format(new Date(v.created_at), 'PPP')}</Badge>
                                                <span className="text-[10px] text-muted-foreground">Dr. {v.doctor?.full_name} @ {v.branches?.name}</span>
                                            </div>
                                            <Badge variant={v.status === 'completed' ? 'default' : 'secondary'}>{v.status}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                    <DiagnosisIcon className="w-3 h-3" /> Diagnosis
                                                </Label>
                                                <p className="text-sm bg-white p-2 rounded border leading-relaxed">
                                                    {v.diagnosis || 'N/A'}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                    <ClipboardList className="w-3 h-3" /> Treatment Notes
                                                </Label>
                                                <p className="text-sm bg-white p-2 rounded border leading-relaxed">
                                                    {v.treatment_notes || 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        {v.service_stages && v.service_stages.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Procedures Performed</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {v.service_stages.map((stage: any) => (
                                                        <Badge key={stage.id} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                                                            {stage.tooth_number ? `Tooth #${stage.tooth_number}` : 'General'}: Stage {stage.current_stage}
                                                            {stage.services?.stage_names?.[stage.current_stage - 1] && ` — ${stage.services.stage_names[stage.current_stage - 1]}`}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {v.xray_urls && v.xray_urls.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                    <Camera className="w-3 h-3" /> Radiographs (X-Rays)
                                                </Label>
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {v.xray_urls.map((url: string, idx: number) => (
                                                        <Dialog key={idx}>
                                                            <DialogTrigger asChild>
                                                                <div className="relative cursor-pointer group rounded-lg border overflow-hidden h-20 w-20 flex-shrink-0 bg-slate-100 shadow-sm hover:ring-2 ring-primary transition-all">
                                                                    <img src={url} alt="X-ray thumbnail" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                                                                </div>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-4xl p-0 bg-black border-0">
                                                                <img src={url} alt="X-ray view" className="max-h-[85vh] w-auto mx-auto object-contain" />
                                                            </DialogContent>
                                                        </Dialog>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setIsHistoryDialogOpen(false)}>Close History</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* X-Ray Upload Modal */}
            <Dialog open={isXrayModalOpen} onOpenChange={setIsXrayModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Patient X-Rays</DialogTitle>
                        <DialogDescription>
                            Upload and manage radiographic images for this visit.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {xrayUrls.map((url, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-slate-100">
                                    <img src={url} alt={`X-ray ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setXrayUrls(xrayUrls.filter((_, i) => i !== idx))}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {uploading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Upload className="w-8 h-8 text-slate-400" />}
                                    <p className="mt-2 text-sm text-slate-500 font-medium">Click to upload</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    disabled={uploading || !!diagnosisLockedAt}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        setUploading(true);
                                        try {
                                            const fileExt = file.name.split('.').pop();
                                            const fileName = `${visitId}/${Math.random()}.${fileExt}`;
                                            const filePath = `x-rays/${fileName}`;

                                            const { error: uploadError, data } = await supabase.storage
                                                .from('medical-records')
                                                .upload(filePath, file);

                                            if (uploadError) throw uploadError;

                                            const { data: { publicUrl } } = supabase.storage
                                                .from('medical-records')
                                                .getPublicUrl(filePath);

                                            setXrayUrls([...xrayUrls, publicUrl]);
                                            toast({ title: "Success", description: "X-ray uploaded successfully." });
                                        } catch (error: any) {
                                            console.error("Upload error:", error);
                                            toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
                                        } finally {
                                            setUploading(false);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setIsXrayModalOpen(false)} className="w-full sm:w-auto">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}