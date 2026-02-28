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
    Loader2, Save, Send, ArrowLeft, Trash2, Plus, AlertTriangle, Lock, Unlock,
    Image as ImageIcon, Upload, X, History, Camera, Stethoscope as DiagnosisIcon,
    ClipboardList, CheckCircle2, Activity, ShieldCheck, User, CreditCard, ChevronRight, CheckSquare
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
    const [periodontalStatus, setPeriodontalStatus] = useState<string[]>([]);
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

    // Pins & Posts State
    const [isPinsPostsModalOpen, setIsPinsPostsModalOpen] = useState(false);
    const [pinsPostsCount, setPinsPostsCount] = useState(1);
    const [pendingPinsPostsData, setPendingPinsPostsData] = useState<{ service: any, startStage: number } | null>(null);

    // Diagnosis Append State
    const [newDiagnosis, setNewDiagnosis] = useState("");
    const [newTreatmentNotes, setNewTreatmentNotes] = useState("");
    const [treatmentDone, setTreatmentDone] = useState("");
    const [tca, setTca] = useState("");

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
    const [isManualStageModalOpen, setIsManualStageModalOpen] = useState(false);
    const [manualSelectedStage, setManualSelectedStage] = useState<number>(1);
    const [skipRemainingStages, setSkipRemainingStages] = useState(false);
    const [followAllStages, setFollowAllStages] = useState(false);
    const [treatmentJustCompleted, setTreatmentJustCompleted] = useState<{ name: string; tooth: number | null; stages: number } | null>(null);

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
        const { data, error } = await (supabase
            .from("visits")
            .select("*, members(*), dependants(*)")
            .eq("id", visitId)
            .single() as any);

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

            // Fetch raw service_stages rows (no join — avoids silent empty results from schema mismatches)
            // Strict separation: principal visits only see stages with dependant_id IS NULL,
            // dependant visits only see stages for that specific dependant_id.
            let stagesBaseQuery = (supabase as any)
                .from("service_stages")
                .select("*")
                .eq("member_id", data.member_id);

            if (data.dependant_id) {
                stagesBaseQuery = stagesBaseQuery.eq("dependant_id", data.dependant_id);
            } else {
                stagesBaseQuery = stagesBaseQuery.is("dependant_id", null);
            }

            const { data: rawStages, error: rawStagesError } = await stagesBaseQuery;

            if (rawStagesError) {
                console.error("[Consultation] Could not fetch service_stages:", rawStagesError.message);
            }

            if (rawStages && rawStages.length > 0) {
                // Enrich with service data (name + stage_names) via a separate query
                // Separating this prevents a join schema mismatch from silently returning []
                const serviceIds = [...new Set(rawStages.map((s: any) => s.service_id))];
                const { data: servicesData } = await (supabase as any)
                    .from("services")
                    .select("id, name, stage_names")
                    .in("id", serviceIds);

                const servicesMap: Record<string, any> = {};
                (servicesData || []).forEach((svc: any) => { servicesMap[svc.id] = svc; });

                const enrichedStages = rawStages.map((s: any) => ({
                    ...s,
                    services: servicesMap[s.service_id] || { name: 'Unknown Service', stage_names: [] }
                }));

                const active = enrichedStages.filter((s: any) => s.status === 'in_progress');
                setActiveStages(active);
                setAllMemberStages(enrichedStages);
            } else {
                setActiveStages([]);
                setAllMemberStages([]);
            }

            // Fetch past visits with X-rays and stages
            const { data: visitsData } = await supabase
                .from("visits")
                .select(`
                    id, 
                    created_at, 
                    diagnosis, 
                    treatment_notes, 
                    treatment_done,
                    tca,
                    periodontal_status,
                    xray_urls, 
                    status,
                    doctor:doctor_id(full_name),
                    branches(name),
                    service_stages(*, services(name, stage_names))
                `)
                .eq("member_id", data.member_id)
                .neq("id", visitId) // Exclude current visit
                .order("created_at", { ascending: false });

            if (visitsData) setPastVisits(visitsData);

            let recordsQuery = (supabase as any)
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

                    // Any tooth with an existing record is locked
                    history[r.tooth_number] = true;
                });
                setToothConditions(conditions);
                setExistingConditions(history);

                // If we have existing records (history) OR current visit records, default to treatment mode
                // so doctor can immediately start treating existing conditions.
                // Unless it's a fresh visit with NO history.
                if (records.length > 0 && !data.diagnosis_locked_at) {
                    setConsultationMode('treatment');
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
            if (data.treatment_done) setTreatmentDone(data.treatment_done);
            if (data.tca) setTca(data.tca);
            if (data.periodontal_status) setPeriodontalStatus(data.periodontal_status || []);
            if (data.xray_urls && Array.isArray(data.xray_urls)) setXrayUrls(data.xray_urls);

            if (data.status === 'registered' && doctorId) {
                await supabase
                    .from("visits")
                    .update({ status: 'with_doctor', doctor_id: doctorId, assigned_doctor_id: doctorId })
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

        // Overlay completed multi-stage treatments (Orange)
        allMemberStages.forEach(stage => {
            if (stage.tooth_number && stage.status === 'completed') {
                effectiveStatus[stage.tooth_number] = 'multi_stage_completed';
            }
        });

        // Overlay active stages (In Progress)
        activeStages.forEach(stage => {
            if (stage.tooth_number) {
                effectiveStatus[stage.tooth_number] = 'in_progress';
            }
        });

        // Overlay current session selections for multi-stage completion
        selectedServices.forEach(s => {
            if (s.tooth_number && s.service.is_multi_stage_update && s.service.isFinal) {
                effectiveStatus[s.tooth_number] = 'multi_stage_completed';
            }
        });

        setToothStatus(effectiveStatus);
    }, [toothConditions, activeStages, allMemberStages, selectedServices]);

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

    const getStageName = (service: any, stageNum: number) => {
        const total = service?.total_stages || '?';
        const customName = (service?.stage_names && service.stage_names[stageNum - 1]) ? ` - ${service.stage_names[stageNum - 1]}` : '';
        return `Stage ${stageNum} of ${total}${customName}`;
    };

    const handleToothClick = (toothId: number) => {
        if (consultationMode === 'diagnosis') {
            // Check if tooth already has a diagnosis
            if (existingConditions[toothId]) {
                toast({ title: "Locked", description: "This tooth has already been diagnosed and its condition cannot be changed.", variant: "default" });
                return;
            }

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

            // Check if this tooth is locked due to an active multi-stage treatment
            const hasActiveStage = activeStages.some(s => s.tooth_number === toothId);
            if (hasActiveStage) {
                const stage = activeStages.find(s => s.tooth_number === toothId);
                toast({
                    title: `Active Treatment: Tooth #${toothId}`,
                    description: `"${stage?.services?.name}" is in progress (Stage ${stage?.current_stage}/${stage?.total_stages}). Use the "Complete Stage" button in the Active Treatment panel above.`,
                    variant: "default"
                });
                return;
            }

            // Safety Check: Is this tooth selectable?
            const isDiagnosed = !!toothConditions[toothId];
            if (!isDiagnosed) {
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

            const combinedDiagnosis = diagnosis + (newDiagnosis ? (diagnosis ? "\n" : "") + newDiagnosis : "");
            const combinedNotes = treatmentNotes + (newTreatmentNotes ? (treatmentNotes ? "\n" : "") + newTreatmentNotes : "");

            const { error: visitError } = await (supabase as any).from("visits").update({
                diagnosis: combinedDiagnosis,
                treatment_notes: combinedNotes,
                treatment_done: treatmentDone,
                tca: tca,
                periodontal_status: periodontalStatus,
                xray_urls: xrayUrls,
                diagnosis_locked_at: new Date().toISOString() // We still track this for state persistence
            }).eq("id", visitId);

            if (visitError) throw visitError;

            setDiagnosis(combinedDiagnosis);
            setTreatmentNotes(combinedNotes);
            setNewDiagnosis("");
            setNewTreatmentNotes("");

            // Permanently lock the diagnosed teeth for this session
            const newExistingConditions = { ...existingConditions };
            Object.keys(toothConditions).forEach(toothId => {
                newExistingConditions[parseInt(toothId)] = true;
            });
            setExistingConditions(newExistingConditions);

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
        // Scaling Restriction: Must have periodontal status
        const scalingNames = ["scaling", "polishing", "scaling and polishing"];
        const isScaling = scalingNames.some(name => service.name.toLowerCase().includes(name));

        if (isScaling && periodontalStatus.length === 0) {
            toast({
                title: "Diagnosis Required",
                description: "You must select at least one periodontal status (Staining, Calculus, or Periodontitis) before adding Scaling services.",
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

                // 0. Block: tooth is under an active multi-stage treatment for ANY service
                //    (The doctor must use the "Complete Stage" button in the panel for these teeth)
                const isLockedByActiveStage = activeStages.some(as => as.tooth_number === tooth);
                if (isLockedByActiveStage) {
                    blockedTeeth.push(tooth);
                    return;
                }

                // 1. Check History: For non-multi-stage, block if already done EVER on this tooth
                const hasExistingRecord = !service.is_multi_stage && serviceHistory.some(h =>
                    h.tooth_number == tooth && h.service_id === service.id
                );

                // 2. Check Active: Is this SAME stage already in progress?
                const isCurrentStageActive = activeStages.some(as =>
                    as.tooth_number === tooth &&
                    as.service_id === service.id &&
                    as.current_stage === startStage
                );

                // 3. Multi-stage progression check
                const maxDone = getMaxStageForSelection(service.id, [tooth]);

                if (isCurrentStageActive) {
                    blockedTeeth.push(tooth);
                } else if (!service.is_multi_stage && hasExistingRecord) {
                    blockedTeeth.push(tooth);
                } else if (service.is_multi_stage && startStage <= maxDone) {
                    blockedTeeth.push(tooth);
                } else {
                    // Clone service to add stage info if needed
                    const multiplier = service.pins_posts_count || 1;
                    const serviceWithStage = {
                        ...service,
                        startAtStage: startStage,
                        benefit_cost: service.benefit_cost * multiplier,
                        branch_compensation: service.branch_compensation * multiplier,
                        real_cost: service.real_cost * multiplier
                    };
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

        // Pins and Posts Special Handling
        if (service.name.toLowerCase().includes("pins and posts")) {
            setPendingPinsPostsData({ service, startStage: 1 });
            setPinsPostsCount(1);
            setIsPinsPostsModalOpen(true);
            return;
        }

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

        if (service.is_multi_stage) {
            // Check if we already have an active stage for General (if no teeth selected)
            if (selectedTeeth.length === 0) {
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

            // Set default stage to next available
            const maxStage = getMaxStageForSelection(service.id, selectedTeeth);

            // MANDATORY ENFORCEMENT: A doctor cannot start a multistage service at Stage 2 or above.
            // If no previous stages done (maxStage == 0), always start at 1.
            if (maxStage === 0) {
                performAddService(service, 1);
                return;
            }

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


    const handleConfirmPinsPosts = () => {
        if (pendingPinsPostsData) {
            const scaledService = {
                ...pendingPinsPostsData.service,
                pins_posts_count: pinsPostsCount
            };
            performAddService(scaledService, pendingPinsPostsData.startStage);
            setIsPinsPostsModalOpen(false);
            setPendingPinsPostsData(null);
        }
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
        setSkipRemainingStages(false);
        setFollowAllStages(false);
        setContinueStageDialogOpen(true);
    };

    const confirmContinueStage = () => {
        if (!pendingContinueStage) return;

        const stage = pendingContinueStage;
        const nextStageNum = followAllStages ? stage.total_stages : stage.current_stage + 1;
        const isFinal = skipRemainingStages || followAllStages || nextStageNum === stage.total_stages;

        // Resolve display name for this stage
        const stageNames: string[] = Array.isArray(stage.services?.stage_names) ? stage.services.stage_names : [];
        let stageName: string | null = stageNames[nextStageNum - 1] || null;

        let displayName = stage.services.name;
        if (followAllStages) {
            displayName += " — ALL REMAINING STAGES COMPLETED";
        } else if (skipRemainingStages) {
            displayName += ` — TREATMENT COMPLETED AT STAGE ${nextStageNum} (Remainder Skipped)`;
        } else if (stageName) {
            displayName += ` — ${stageName}`;
        }

        // Create a 'virtual' service object for the bill
        const stageService = {
            id: stage.service_id,
            name: displayName,
            benefit_cost: 0, // No charge for subsequent stages
            branch_compensation: 0,
            real_cost: 0,
            is_multi_stage_update: true,
            startAtStage: nextStageNum,
            total_stages: stage.total_stages,
            stageId: stage.id,
            nextStage: nextStageNum,
            isFinal: isFinal,
            notes: stageNotes + (skipRemainingStages ? " (Skipped remaining stages)" : "") + (followAllStages ? " (Followed all stages today)" : ""),
            related_bill_id: stage.related_bill_id,
            skipRemaining: skipRemainingStages,
            followedAll: followAllStages
        };

        setSelectedServices([...selectedServices, { service: stageService, tooth_number: stage.tooth_number }]);

        if (isFinal) {
            toast({
                title: `Treatment Marked for Completion`,
                description: followAllStages
                    ? `Recording all remaining stages for "${stage.services.name}".`
                    : skipRemainingStages
                        ? `Recording Stage ${nextStageNum} and closing the treatment.`
                        : `Final stage of "${stage.services.name}" added.`
            });
        } else {
            toast({ title: "Stage Added", description: `Stage ${nextStageNum}/${stage.total_stages} scheduled for completion.` });
        }

        setContinueStageDialogOpen(false);
        setPendingContinueStage(null);
    };

    const confirmManualStageSelection = async () => {
        if (!pendingContinueStage) return;

        const stage = pendingContinueStage;
        const isFinal = manualSelectedStage === stage.total_stages;

        // Resolve display name for this stage
        const stageNames: string[] = Array.isArray(stage.services?.stage_names) ? stage.services.stage_names : [];
        let stageName: string | null = stageNames[manualSelectedStage - 1] || null;

        let displayName = `${stage.services.name} — MANUALLY SELECTED STAGE ${manualSelectedStage}`;
        if (stageName) {
            displayName += ` (${stageName})`;
        }

        const auditNote = `Doctor manually skipped from Stage ${stage.current_stage} to Stage ${manualSelectedStage}`;

        // Log audit information
        try {
            await (supabase as any).from('system_logs').insert({
                action: 'MANUAL_STAGE_JUMP',
                details: {
                    member_id: visit.member_id,
                    dependant_id: visit.dependant_id,
                    service_id: stage.service_id,
                    tooth_number: stage.tooth_number,
                    previous_stage: stage.current_stage,
                    new_stage: manualSelectedStage,
                    doctor_id: doctorId,
                    note: "Manual stage selection used",
                    clinical_note: auditNote
                },
                user_id: doctorId
            });
        } catch (err) {
            console.error("Audit log failed:", err);
        }

        // Create a 'virtual' service object for the bill
        const stageService = {
            id: stage.service_id,
            name: displayName,
            benefit_cost: 0,
            branch_compensation: 0,
            real_cost: 0,
            is_multi_stage_update: true,
            startAtStage: manualSelectedStage,
            total_stages: stage.total_stages,
            stageId: stage.id,
            nextStage: manualSelectedStage,
            isFinal: isFinal,
            notes: (stageNotes ? stageNotes + " | " : "") + auditNote,
            related_bill_id: stage.related_bill_id,
            isManualJump: true,
            previousStage: stage.current_stage
        };

        setSelectedServices([...selectedServices, { service: stageService, tooth_number: stage.tooth_number }]);

        toast({
            title: "Manual Stage Selected",
            description: `Advanced to Stage ${manualSelectedStage}/${stage.total_stages}. ${isFinal ? "This is the final stage." : ""}`
        });

        setIsManualStageModalOpen(false);
        setPendingContinueStage(null);
        setStageNotes("");
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

            const combinedDiagnosis = diagnosis + (newDiagnosis ? (diagnosis ? "\n" : "") + newDiagnosis : "");
            const combinedNotes = treatmentNotes + (newTreatmentNotes ? (treatmentNotes ? "\n" : "") + newTreatmentNotes : "");

            const { error: updateError } = await supabase.from("visits").update({
                diagnosis: combinedDiagnosis,
                treatment_notes: combinedNotes,
                periodontal_status: periodontalStatus,
                xray_urls: xrayUrls
            }).eq("id", visitId);

            if (updateError) throw updateError;

            setDiagnosis(combinedDiagnosis);
            setTreatmentNotes(combinedNotes);
            setNewDiagnosis("");
            setNewTreatmentNotes("");

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

        const { data: existingVisits, error: checkError } = await (checkQuery as any);

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

            const newMultiStageServices = selectedServices.filter(s => s.service.is_multi_stage && !s.service.is_multi_stage_update);
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
                        itemName += ` (Stage ${s.service.startAtStage}/${s.service.total_stages || '?'})`;
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
                    service_name: `${s.service.name} (Stage ${s.service.startAtStage || 1} - Full Payment)`,
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

                    const { error: stageInsertError } = await (supabase as any).from("service_stages").insert({
                        service_id: item.service.id,
                        member_id: visit.member_id,
                        dependant_id: visit.dependant_id || null,
                        visit_id: visitId,
                        tooth_number: item.tooth_number || null,
                        current_stage: item.service.startAtStage || 1,
                        total_stages: item.service.total_stages,
                        status: 'in_progress',
                        related_bill_id: lockedBill.id,
                        pending_claim_id: pendingClaim.id,
                        notes: `Started in visit ${visitId} on tooth ${item.tooth_number}`
                    });

                    if (stageInsertError) {
                        console.error("[Finalize] FAILED to insert service_stages:", stageInsertError);
                        throw stageInsertError;
                    } else {
                        console.log("[Finalize] service_stages row created for:", item.service.name, "tooth:", item.tooth_number, "member:", visit.member_id);
                    }
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
            const currentUser = (await supabase.auth.getUser()).data.user;

            for (const item of updates) {
                const currentStage = item.service.startAtStage; // This holds the *next* stage
                const isFinal = item.service.isFinal || currentStage === item.service.total_stages;

                const { error: stageUpdateError } = await (supabase as any)
                    .from("service_stages")
                    .update({
                        current_stage: currentStage,
                        status: 'in_progress', // Keep as in_progress; finalize_invoice_rpc will flip to completed
                        marked_complete_by_doctor: isFinal,
                        updated_at: new Date().toISOString(),
                        visit_id: visitId,
                        notes: item.service.notes
                    })
                    .eq("id", item.service.stageId || item.service.stage_id);

                if (stageUpdateError) {
                    console.error("Error updating service stage:", stageUpdateError);
                    toast({
                        title: "Warning",
                        description: `Failed to update stage for ${item.service.name}. Please contact support.`,
                        variant: "destructive"
                    });
                    throw stageUpdateError;
                }

                // ✅ Audit logging for each stage completion
                await (supabase as any).from("system_logs").insert({
                    action: isFinal ? "multi_stage_service_completed" : "multi_stage_stage_completed",
                    details: {
                        tooth_id: item.tooth_number ? item.tooth_number.toString() : null,
                        service_id: item.service.id,
                        service_name: item.service.name,
                        current_stage: currentStage,
                        total_stages: item.service.total_stages,
                        doctor_id: doctorId,
                        visit_id: visitId,
                        notes: item.service.notes || "",
                        is_final: isFinal
                    },
                    user_id: currentUser?.id
                });

                if (isFinal) {
                    console.log("Final stage marked by doctor. Funds will be released after receptionist bills this visit.");

                    // Track completed treatment for UI feedback
                    setTreatmentJustCompleted({
                        name: item.service.name,
                        tooth: item.tooth_number,
                        stages: item.service.total_stages
                    });
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
                treatment_done: treatmentDone,
                tca: tca,
                doctor_id: doctorId,
                benefit_deducted: 0,
                branch_compensation: 0,
                profit_loss: 0
            }).eq("id", visitId);

            if (visitUpdateError) throw visitUpdateError;

            // Determine the right success message
            const hasOnlyFollowUps = selectedServices.every(s => s.service.is_multi_stage_update);
            const hasFinalStage = selectedServices.some(s => s.service.is_multi_stage_update && s.service.isFinal);

            if (hasFinalStage) {
                toast({
                    title: "Treatment Complete! 🎉",
                    description: "All stages completed. Branch Director has been notified to review the claim."
                });
            } else if (hasOnlyFollowUps) {
                toast({
                    title: "Stage Completed",
                    description: "Treatment stage recorded. Patient will return for the next visit."
                });
            } else {
                toast({ title: "Consultation Completed", description: "Bill generated and sent to reception for finalization." });
            }

            await (supabase as any).from("system_logs").insert({
                action: "Consultation Submitted",
                details: { visit_id: visitId, doctor_id: doctorId, services_count: selectedServices.length, bill_id: primaryBillId, has_follow_up_stages: hasOnlyFollowUps },
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
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
            {/* Premium Structured Patient Header */}
            <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/doctor")}
                            className="h-12 w-12 rounded-xl border bg-slate-50 hover:bg-slate-100 shrink-0 transition-all hover:scale-105"
                        >
                            <ArrowLeft className="h-6 w-6 text-slate-600" />
                        </Button>
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                    {patientName}
                                </h1>
                                {isChild && (
                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 px-3 py-1 font-bold">
                                        Pediatric Patient
                                    </Badge>
                                )}
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 px-3 py-1 font-mono">
                                    Visit #{visitId?.slice(0, 8).toUpperCase()}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 overflow-x-auto whitespace-nowrap pb-1">
                                <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> {visit.members.member_number}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span>{patientAge} Years Old</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> {visit.dependants?.document_number || visit.members.id_number || 'No ID Provided'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsHistoryDialogOpen(true)}
                            className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700 font-bold px-5 h-12 rounded-xl transition-all hover:border-blue-300 shadow-sm"
                        >
                            <History className="w-5 h-5 mr-2" />
                            Clinical History
                        </Button>
                        <Dialog open={isXrayModalOpen} onOpenChange={setIsXrayModalOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 h-12 rounded-xl shadow-lg transition-all active:scale-95"
                                >
                                    <ImageIcon className="w-5 h-5 mr-2" />
                                    Radiographs {xrayUrls.length > 0 && `(${xrayUrls.length})`}
                                </Button>
                            </DialogTrigger>
                        </Dialog>
                    </div>
                </div>

                {visit.dependants && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm">
                        <span className="text-slate-400 font-medium">Principal Account:</span>
                        <span className="font-bold text-slate-700">{visit.members.full_name}</span>
                        <Badge variant="outline" className="text-[10px] font-bold px-1.5 h-5 leading-none bg-slate-50">{visit.members.member_number}</Badge>
                    </div>
                )}
            </div>

            {/* Follow-up / Ongoing Alert */}
            {activeStages.length > 0 && selectedServices.length === 0 && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 flex items-start gap-4 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                        <Activity className="h-6 w-6 text-white animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-black text-xl text-blue-900 leading-tight">Ongoing Treatment Workflow</p>
                        <p className="text-blue-700 font-medium text-sm">
                            Patient has <span className="font-black underline">{activeStages.length} pending procedure(s)</span>.
                            Use the <span className="bg-blue-200 px-1 rounded text-blue-900">Complete Stage</span> controls below to progress clinical work.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid lg:grid-cols-4 gap-8 items-start">
                <div className="lg:col-span-3 space-y-8">
                    {activeStages.length > 0 && (
                        <Card className="border-blue-300 bg-blue-50/80 shadow-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-blue-900 flex items-center gap-2 text-xl">
                                    <History className="h-6 w-6" />
                                    Active Multi-Stage Treatment{activeStages.length > 1 ? 's' : ''}
                                </CardTitle>
                                <CardDescription className="text-blue-700 font-medium">Continue progressing ongoing procedures. No new charges for follow-up stages.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeStages.map(stage => {
                                    // NUMERIC-ONLY logic — stage names are display-only
                                    const nextStageNum = stage.current_stage + 1;  // e.g. 4
                                    const isFinalStage = nextStageNum === stage.total_stages; // e.g. 4 === 5 → false; 5 === 5 → true
                                    const progress = (stage.current_stage / stage.total_stages) * 100;

                                    // Display-only: resolve stage names if available
                                    const stageNames: string[] = Array.isArray(stage.services?.stage_names) ? stage.services.stage_names : [];
                                    const nextStageName: string | null = stageNames[nextStageNum - 1] || null; // index 0-based

                                    const isAlreadyAdded = selectedServices.some(s =>
                                        s.service.stageId === stage.id
                                    );

                                    return (
                                        <div key={stage.id} className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm space-y-4">
                                            {/* Header */}
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-black text-lg text-slate-900">{stage.services?.name || 'Treatment'}</h4>
                                                        {stage.tooth_number && (
                                                            <Badge className="bg-blue-600">Tooth #{stage.tooth_number}</Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-slate-600 border-slate-300">In Progress</Badge>
                                                    </div>

                                                    {/* ✅ KEY DISPLAY: "Continue Stage X of Y — NAME" */}
                                                    <p className="font-bold text-blue-900 text-sm">
                                                        Continue Stage {nextStageNum} of {stage.total_stages}
                                                        {nextStageName ? ` — ${nextStageName.toUpperCase()}` : ''}
                                                        {isFinalStage && (
                                                            <span className="ml-2 text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Final Stage</span>
                                                        )}
                                                    </p>

                                                    {stage.notes && (
                                                        <p className="text-xs text-slate-500 italic">Last visit: {stage.notes}</p>
                                                    )}
                                                </div>

                                                {isAlreadyAdded ? (
                                                    <Badge variant="outline" className="h-10 px-4 text-blue-700 bg-blue-50 border-blue-200 font-bold gap-2 shrink-0">
                                                        ✓ Ready for Submission
                                                    </Badge>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            size="lg"
                                                            className={`font-bold shadow-lg gap-2 shrink-0 ${isFinalStage
                                                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                                                : 'bg-blue-700 hover:bg-blue-800'
                                                                } text-white`}
                                                            onClick={() => handleContinueStage(stage)}
                                                        >
                                                            {isFinalStage ? 'Complete Final Stage' : `Complete Stage ${nextStageNum}`}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                                            onClick={() => {
                                                                setPendingContinueStage(stage);
                                                                setManualSelectedStage(stage.current_stage + 1);
                                                                setIsManualStageModalOpen(true);
                                                            }}
                                                        >
                                                            Select Next Treatment Stage
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs font-bold text-blue-900 uppercase">
                                                    <span>Treatment Progress</span>
                                                    <span>{Math.round(progress)}% ({stage.current_stage}/{stage.total_stages} stages done)</span>
                                                </div>
                                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border">
                                                    <div
                                                        className="h-full bg-blue-600 transition-all duration-500"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <div className="flex gap-1 mt-1">
                                                    {Array.from({ length: stage.total_stages }, (_, i) => (
                                                        <div
                                                            key={i}
                                                            title={stageNames[i] ? `Stage ${i + 1}: ${stageNames[i]}` : `Stage ${i + 1}`}
                                                            className={`flex-1 h-1.5 rounded-full transition-colors ${i < stage.current_stage
                                                                ? 'bg-blue-500'
                                                                : i === stage.current_stage && isAlreadyAdded
                                                                    ? 'bg-emerald-400'
                                                                    : 'bg-slate-200'
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card className={cn(
                        "transition-all duration-500 rounded-2xl shadow-xl overflow-hidden border-none ring-1",
                        consultationMode === 'diagnosis' ? "ring-orange-200 bg-white" : "ring-slate-200 bg-white"
                    )}>
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
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                                onClick={() => setIsXrayModalOpen(true)}
                                            >
                                                <ImageIcon className="w-3 h-3 mr-1" />
                                                {xrayUrls.length > 0 ? `X-Rays (${xrayUrls.length})` : 'X-Rays'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs mr-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                                                onClick={() => setConsultationMode('diagnosis')}
                                            >
                                                <Plus className="w-3 h-3 mr-1" /> Add Diagnosis
                                            </Button>
                                        </>
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
                                <div className="space-y-6">
                                    <div className="p-4 bg-white rounded-xl border shadow-sm space-y-3">
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

                                    {/* Periodontal Status Selection - Only in Diagnosis Phase */}
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 block">Periodontal Status</Label>
                                        <div className="flex flex-wrap gap-3">
                                            {[
                                                { value: 'staining', label: 'Staining', color: 'bg-yellow-400' },
                                                { value: 'calculus', label: 'Calculus', color: 'bg-orange-400' },
                                                { value: 'periodontitis', label: 'Periodontitis', color: 'bg-red-500' },
                                                { value: 'gingivitis', label: 'Gingivitis', color: 'bg-pink-500' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => {
                                                        if (periodontalStatus.includes(opt.value)) {
                                                            setPeriodontalStatus(periodontalStatus.filter(s => s !== opt.value));
                                                        } else {
                                                            setPeriodontalStatus([...periodontalStatus, opt.value]);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                                                        periodontalStatus.includes(opt.value)
                                                            ? "ring-2 ring-offset-1 ring-primary border-primary bg-primary/5"
                                                            : "bg-white hover:bg-slate-50"
                                                    )}
                                                >
                                                    <div className={cn("w-3 h-3 rounded-full", opt.color)} />
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        {periodontalStatus.length > 0 && (
                                            <p className="text-xs text-primary font-medium mt-2">
                                                ✓ {periodontalStatus.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")} selected
                                            </p>
                                        )}
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
                                                        <div key={stage.id} className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                    <span className="font-bold text-amber-900">Tooth {t}:</span>
                                                                    <span className="text-amber-800">{stage.services?.name}</span>
                                                                </div>
                                                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 font-bold">
                                                                    Stage {stage.current_stage} Completed
                                                                </Badge>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full h-8 text-[10px] font-bold border-amber-300 text-amber-800 hover:bg-amber-100 mt-1"
                                                                onClick={() => {
                                                                    setPendingContinueStage(stage);
                                                                    setManualSelectedStage(stage.current_stage + 1);
                                                                    setIsManualStageModalOpen(true);
                                                                }}
                                                            >
                                                                Select Next Treatment Stage Manually
                                                            </Button>
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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle>Clinical Notes & Diagnosis</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setIsXrayModalOpen(true)} className="border-blue-200 text-blue-700 bg-blue-50/50">
                                <ImageIcon className="w-4 h-4 mr-2" />
                                {xrayUrls.length > 0 ? `X-Rays (${xrayUrls.length})` : 'X-Rays'}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="diagnosis" className="flex items-center justify-between">
                                        <span>Diagnosis</span>
                                        {diagnosis && <Badge variant="outline" className="text-[10px] uppercase font-normal text-muted-foreground">Read Only (Saved)</Badge>}
                                    </Label>
                                    {diagnosis && (
                                        <div className="p-3 bg-slate-50 rounded-md border text-sm text-slate-600 mb-2 whitespace-pre-wrap italic">
                                            {diagnosis}
                                        </div>
                                    )}
                                    <Textarea
                                        id="add-diagnosis"
                                        placeholder={diagnosis ? "Add more to diagnosis..." : "Enter diagnosis..."}
                                        className="min-h-[80px]"
                                        value={newDiagnosis}
                                        onChange={(e) => setNewDiagnosis(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="treatmentNotes" className="flex items-center justify-between">
                                        <span>Treatment Plan</span>
                                        {treatmentNotes && <Badge variant="outline" className="text-[10px] uppercase font-normal text-muted-foreground">Read Only (Saved)</Badge>}
                                    </Label>
                                    {treatmentNotes && (
                                        <div className="p-3 bg-slate-50 rounded-md border text-sm text-slate-600 mb-2 whitespace-pre-wrap italic">
                                            {treatmentNotes}
                                        </div>
                                    )}
                                    <Textarea
                                        id="add-treatment-notes"
                                        placeholder={treatmentNotes ? "Add more treatment notes..." : "Enter treatment notes..."}
                                        className="min-h-[120px]"
                                        value={newTreatmentNotes}
                                        onChange={(e) => setNewTreatmentNotes(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-4 pt-4 border-t mt-4">
                                    <div className="space-y-2">
                                        <Label>Treatment Done Today</Label>
                                        <Textarea
                                            placeholder="Summarize the procedures performed..."
                                            value={treatmentDone}
                                            onChange={(e) => setTreatmentDone(e.target.value)}
                                            className="min-h-[100px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>To Come Again (TCA) / Follow-up Instructions</Label>
                                        <Input
                                            placeholder="Next appointment date or instructions..."
                                            value={tca}
                                            onChange={(e) => setTca(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={handleSaveDraft} disabled={submitting}>
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Draft
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Billable Services - Updated Design */}
                    <Card className="rounded-2xl shadow-xl border-none ring-1 ring-slate-100 overflow-hidden">
                        <div className="bg-slate-50/80 px-6 py-4 border-b flex items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">
                                Billable Procedures
                            </CardTitle>
                            <Badge variant="outline" className="bg-white font-bold text-primary border-primary/20">
                                {selectedServices.length} Items Selected
                            </Badge>
                        </div>
                        <CardContent className="p-0">
                            {selectedServices.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed">
                                        <Plus className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="font-medium">No procedures added yet.</p>
                                    <p className="text-xs">Select teeth and choose a procedure to begin billing.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {selectedServices.map((s, index) => (
                                        <div key={`${s.service.id}-${index}`} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0 border border-blue-100">
                                                    {s.tooth_number || "G"}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">{s.service.name}</span>
                                                        {s.service.is_multi_stage && (
                                                            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100 text-[9px] px-1.5 h-4 font-bold uppercase">
                                                                {getStageName(s.service, s.service.startAtStage || 1)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        {s.tooth_number ? `Tooth #${s.tooth_number}` : 'Full Arch / General'} • KES {s.service.benefit_cost.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeService(index)}
                                                className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg group-hover:opacity-100 opacity-50 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* STICKY SIDEBAR: Eligibility & Summary */}
                <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6">
                    {/* Active Treatments Summary Widget */}
                    {activeStages.length > 0 && (
                        <div className="bg-slate-900 rounded-2xl p-5 shadow-2xl overflow-hidden relative group border border-slate-800">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                            <h3 className="text-slate-100 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-400" />
                                Case Overview
                            </h3>
                            <div className="space-y-3">
                                {activeStages.map((stage) => (
                                    <div key={stage.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-slate-300 font-bold text-xs">{stage.tooth_number ? `Tooth ${stage.tooth_number}` : 'General'}</span>
                                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-blue-600/20 text-blue-400 border-none">
                                                {getStageName(stage.services, stage.current_stage)}
                                            </Badge>
                                        </div>
                                        <div className="w-full bg-slate-700 h-1 rounded-full mb-1">
                                            <div className="bg-blue-400 h-full rounded-full" style={{ width: `${(stage.current_stage / stage.total_stages) * 100}%` }} />
                                        </div>
                                        <p className="text-[10px] text-slate-500 truncate">{stage.services?.name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Eligibility & Billing Card */}
                    <Card className="rounded-2xl shadow-xl border-none ring-1 ring-slate-100 overflow-hidden">
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                    Eligibility Check
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Coverage Balance</span>
                                            <span className="text-lg font-black text-slate-900">KES {visit.members.coverage_balance?.toLocaleString()}</span>
                                        </div>
                                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white rounded-xl border shadow-sm space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-medium">Session Total</span>
                                            <span className="font-bold text-slate-900">KES {selectedServices.filter(s => !s.service.is_multi_stage_update).reduce((acc, s) => acc + Number(s.service.benefit_cost), 0).toLocaleString()}</span>
                                        </div>
                                        <div className="h-px bg-slate-100 w-full" />
                                        <div className="flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Estimated Deduction</span>
                                                <span className="text-xl font-black text-primary">
                                                    KES {Math.min(selectedServices.filter(s => !s.service.is_multi_stage_update).reduce((acc, s) => acc + Number(s.service.benefit_cost), 0), visit.members.coverage_balance || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const hasOnlyFollowUps = selectedServices.length > 0 && selectedServices.every(s => s.service.is_multi_stage_update);
                                const hasFinalStage = selectedServices.some(s => s.service.is_multi_stage_update && s.service.isFinal);
                                const buttonLabel = hasFinalStage
                                    ? "Complete Case"
                                    : hasOnlyFollowUps
                                        ? "Record Progress"
                                        : "Submit Visit Bill";

                                return (
                                    <div className="space-y-3">
                                        <Button
                                            className={cn(
                                                "w-full h-14 text-base font-black rounded-xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 text-white",
                                                hasFinalStage ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" :
                                                    hasOnlyFollowUps ? "bg-blue-700 hover:bg-blue-800 shadow-blue-100" :
                                                        "bg-slate-900 hover:bg-slate-800 shadow-slate-200"
                                            )}
                                            onClick={handleFinalize}
                                            disabled={submitting || selectedServices.length === 0}
                                        >
                                            {submitting ? (
                                                <Loader2 className="animate-spin mr-2" />
                                            ) : hasFinalStage ? (
                                                <CheckSquare className="mr-2 h-5 w-5" />
                                            ) : (
                                                <Send className="mr-2 h-5 w-5" />
                                            )}
                                            {buttonLabel}
                                        </Button>
                                        <p className="text-[10px] text-center text-slate-400 font-medium italic">
                                            * Submitting will lock the clinical record for this session.
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    </Card>

                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-10 border-dashed text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                        onClick={handleSaveDraft}
                        disabled={submitting}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Quick Save Progress
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            Continue Treatment Stage
                        </DialogTitle>
                        <DialogDescription>
                            Record the details for this stage visit.
                        </DialogDescription>
                    </DialogHeader>
                    {pendingContinueStage && (() => {
                        const nextStageNum = pendingContinueStage.current_stage + 1;
                        const isFinal = nextStageNum === pendingContinueStage.total_stages;
                        const stageNames: string[] = Array.isArray(pendingContinueStage.services?.stage_names) ? pendingContinueStage.services.stage_names : [];
                        const stageName: string | null = stageNames[nextStageNum - 1] || null;
                        const progress = (pendingContinueStage.current_stage / pendingContinueStage.total_stages) * 100;

                        return (
                            <div className="space-y-4 py-3">
                                {/* Treatment Summary */}
                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-black text-blue-900 text-base">{pendingContinueStage.services?.name}</p>
                                            {pendingContinueStage.tooth_number && (
                                                <p className="text-sm text-blue-700 font-medium">Tooth #{pendingContinueStage.tooth_number}</p>
                                            )}
                                        </div>
                                        {isFinal ? (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">Final Stage</span>
                                        ) : (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 shrink-0">In Progress</span>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-blue-900">
                                            <span>Completing {getStageName(pendingContinueStage.services, nextStageNum)}</span>
                                            <span>{Math.round((nextStageNum / pendingContinueStage.total_stages) * 100)}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${isFinal ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                style={{ width: `${(nextStageNum / pendingContinueStage.total_stages) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex gap-1 mt-1">
                                            {Array.from({ length: pendingContinueStage.total_stages }, (_, i) => (
                                                <div
                                                    key={i}
                                                    title={stageNames[i] ? `Stage ${i + 1}: ${stageNames[i]}` : `Stage ${i + 1}`}
                                                    className={`flex-1 h-1.5 rounded-full ${i < nextStageNum ? (isFinal && i === nextStageNum - 1 ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-200'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="text-xs text-blue-600 font-medium bg-blue-100 px-3 py-1.5 rounded-lg">
                                        💡 No additional billing — coverage was locked at Stage 1
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="font-semibold block text-blue-900 mb-2">Stage Completion Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                                    <Textarea
                                        placeholder={`Describe what was done in ${getStageName(pendingContinueStage.services, nextStageNum)}...`}
                                        value={stageNotes}
                                        onChange={(e) => setStageNotes(e.target.value)}
                                        className="min-h-[90px] border-blue-200"
                                    />
                                </div>

                                {/* Advanced Completion Options if more than 2 stages total */}
                                {pendingContinueStage.total_stages > 2 && !isFinal && (
                                    <div className="pt-4 border-t border-blue-100 flex flex-col gap-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Advanced Options</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="outline"
                                                type="button"
                                                size="sm"
                                                className={cn(
                                                    "text-xs h-auto py-2 px-3 flex flex-col gap-1 items-start text-left border-dashed",
                                                    skipRemainingStages ? "bg-amber-100 border-amber-300 text-amber-800" : "hover:bg-amber-50 border-amber-200 text-amber-600"
                                                )}
                                                onClick={() => {
                                                    setSkipRemainingStages(!skipRemainingStages);
                                                    setFollowAllStages(false);
                                                }}
                                            >
                                                <span className="font-bold">Skip Remaining Stages</span>
                                                <span className="text-[9px] opacity-70">Marks treatment as completed today.</span>
                                            </Button>

                                            <Button
                                                variant="outline"
                                                type="button"
                                                size="sm"
                                                className={cn(
                                                    "text-xs h-auto py-2 px-3 flex flex-col gap-1 items-start text-left border-dashed",
                                                    followAllStages ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "hover:bg-emerald-50 border-emerald-200 text-emerald-600"
                                                )}
                                                onClick={() => {
                                                    setFollowAllStages(!followAllStages);
                                                    setSkipRemainingStages(false);
                                                }}
                                            >
                                                <span className="font-bold">Follow All Stages</span>
                                                <span className="text-[9px] opacity-70">Complete all remaining steps at once.</span>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setContinueStageDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={confirmContinueStage}
                            className={pendingContinueStage && (pendingContinueStage.current_stage + 1) === pendingContinueStage.total_stages
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-blue-700 hover:bg-blue-800'
                            }
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {pendingContinueStage && (pendingContinueStage.current_stage + 1) === pendingContinueStage.total_stages
                                ? 'Confirm Final Stage'
                                : 'Confirm Stage Completion'
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isManualStageModalOpen} onOpenChange={setIsManualStageModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-amber-600" />
                            Select Next Treatment Stage
                        </DialogTitle>
                        <DialogDescription>
                            Manually choose the next stage for this procedure.
                        </DialogDescription>
                    </DialogHeader>
                    {pendingContinueStage && (() => {
                        const stageNames: string[] = Array.isArray(pendingContinueStage.services?.stage_names) ? pendingContinueStage.services.stage_names : [];

                        return (
                            <div className="space-y-6 py-3">
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                    <p className="font-black text-amber-900 text-base">{pendingContinueStage.services?.name}</p>
                                    <p className="text-sm text-amber-700 font-bold">Current Progress: Stage {pendingContinueStage.current_stage} of {pendingContinueStage.total_stages}</p>
                                </div>

                                <div className="space-y-3">
                                    <Label className="font-bold text-slate-900">Choose Next Stage</Label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Array.from({ length: pendingContinueStage.total_stages }, (_, i) => {
                                            const stageNum = i + 1;
                                            const isCurrent = stageNum === pendingContinueStage.current_stage;
                                            const isPast = stageNum < pendingContinueStage.current_stage;
                                            const stageName = stageNames[i];

                                            return (
                                                <button
                                                    key={stageNum}
                                                    type="button"
                                                    disabled={isCurrent || isPast}
                                                    onClick={() => setManualSelectedStage(stageNum)}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                                        manualSelectedStage === stageNum
                                                            ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm"
                                                            : (isCurrent || isPast)
                                                                ? "bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed"
                                                                : "bg-white border-slate-200 hover:border-blue-300"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black",
                                                            isPast ? "bg-slate-200 text-slate-500" :
                                                                isCurrent ? "bg-slate-300 text-slate-600" :
                                                                    manualSelectedStage === stageNum ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {isCurrent ? "✓" : stageNum}
                                                        </div>
                                                        <div>
                                                            <p className={cn("text-sm font-bold", manualSelectedStage === stageNum ? "text-blue-900" : "text-slate-700")}>
                                                                Stage {stageNum}{stageName ? ` — ${stageName}` : ""}
                                                            </p>
                                                            {isCurrent && <p className="text-[10px] text-slate-500 font-medium">Already Completed</p>}
                                                            {i === 0 && !isPast && !isCurrent && <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Initial Billing Stage</p>}
                                                        </div>
                                                    </div>
                                                    {manualSelectedStage === stageNum && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex gap-3">
                                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                        <p className="text-[11px] text-amber-900 font-bold leading-relaxed">
                                            “Selecting a later stage assumes the earlier stages are clinically not required. This action will be audited.”
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-900 text-xs uppercase tracking-widest">Audit Justification Notes</Label>
                                    <Textarea
                                        placeholder="Briefly explain why stages are being skipped..."
                                        value={stageNotes}
                                        onChange={(e) => setStageNotes(e.target.value)}
                                        className="min-h-[80px] border-slate-200 bg-slate-50/50"
                                    />
                                </div>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManualStageModalOpen(false)} className="rounded-lg">Cancel</Button>
                        <Button onClick={confirmManualStageSelection} className="bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg px-8">
                            Confirm Selection
                        </Button>
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
                                            <Badge className={v.status === 'completed' ? 'bg-green-600 text-white' : ''} variant={v.status === 'completed' ? 'default' : 'secondary'}>{v.status}</Badge>
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
                                                    {v.service_stages.map((stage: any) => {
                                                        const stageNames: string[] = Array.isArray(stage.services?.stage_names) ? stage.services.stage_names : [];
                                                        const stageName = stageNames[stage.current_stage - 1];
                                                        return (
                                                            <Badge key={stage.id} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 flex flex-col items-start gap-0.5 h-auto py-1 px-2">
                                                                <span className="font-bold">{stage.tooth_number ? `Tooth #${stage.tooth_number}` : 'General'}: {stage.services?.name}</span>
                                                                <span className="text-[10px] opacity-80">Stage {stage.current_stage} of {stage.total_stages}{stageName ? ` — ${stageName}` : ""}</span>
                                                                {stage.notes && <span className="text-[9px] italic border-t border-blue-100 mt-0.5 pt-0.5 w-full">{stage.notes}</span>}
                                                            </Badge>
                                                        );
                                                    })}
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

            {/* X-Ray Upload / View Modal */}
            <Dialog open={isXrayModalOpen} onOpenChange={setIsXrayModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-blue-600" />
                            Radiographic Images (X-Rays)
                        </DialogTitle>
                        <DialogDescription>
                            {diagnosisLockedAt
                                ? "X-rays for this visit — read-only after diagnosis is saved."
                                : "Upload radiographic images (JPG, PNG, PDF). Multiple files supported."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Image Grid */}
                        {xrayUrls.length === 0 && diagnosisLockedAt && (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <ImageIcon className="w-12 h-12 mb-2 opacity-30" />
                                <p className="text-sm">No X-rays were uploaded for this visit.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {xrayUrls.map((url, idx) => (
                                <Dialog key={idx}>
                                    <DialogTrigger asChild>
                                        <div className="relative group aspect-square rounded-lg overflow-hidden border bg-slate-100 cursor-zoom-in shadow-sm hover:ring-2 ring-primary transition-all">
                                            {url.toLowerCase().endsWith('.pdf') ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                                                    <span className="text-3xl">📄</span>
                                                    <span className="text-xs font-semibold text-red-700 mt-1">PDF X-Ray {idx + 1}</span>
                                                </div>
                                            ) : (
                                                <img src={url} alt={`X-ray ${idx + 1}`} className="w-full h-full object-cover transition-opacity group-hover:opacity-80" />
                                            )}
                                            {/* Delete only allowed before diagnosis is locked */}
                                            {!diagnosisLockedAt && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setXrayUrls(xrayUrls.filter((_, i) => i !== idx)); }}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl p-0 bg-black border-0">
                                        <DialogHeader className="hidden"><DialogTitle>X-Ray {idx + 1}</DialogTitle></DialogHeader>
                                        {url.toLowerCase().endsWith('.pdf') ? (
                                            <iframe src={url} className="w-full" style={{ height: '85vh' }} title={`X-Ray PDF ${idx + 1}`} />
                                        ) : (
                                            <img src={url} alt={`X-ray fullscreen ${idx + 1}`} className="max-h-[85vh] w-auto mx-auto object-contain" />
                                        )}
                                    </DialogContent>
                                </Dialog>
                            ))}

                            {/* Upload drop zone — always available for doctors to add records */}
                            <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all">
                                <div className="flex flex-col items-center justify-center p-4">
                                    {uploading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Upload className="w-8 h-8 text-slate-400" />}
                                    <p className="mt-2 text-xs text-slate-500 font-medium text-center">Click to upload<br /><span className="text-[10px]">JPG · PNG · PDF</span></p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                                    multiple
                                    disabled={uploading}
                                    onChange={async (e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length === 0) return;
                                        setUploading(true);
                                        const newUrls: string[] = [];
                                        try {
                                            for (const file of files) {
                                                const fileExt = file.name.split('.').pop();
                                                const fileName = `${visitId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
                                                const filePath = `x-rays/${fileName}`;

                                                const { error: uploadError } = await supabase.storage
                                                    .from('medical-records')
                                                    .upload(filePath, file);
                                                if (uploadError) throw uploadError;

                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('medical-records')
                                                    .getPublicUrl(filePath);

                                                newUrls.push(publicUrl);

                                                // Save structured metadata to xray_images table
                                                if (visit && doctorId && doctorBranchId) {
                                                    await (supabase as any).from('xray_images').insert({
                                                        member_id: visit.member_id,
                                                        dependant_id: visit.dependant_id || null,
                                                        visit_id: visitId,
                                                        doctor_id: doctorId,
                                                        branch_id: doctorBranchId,
                                                        image_url: publicUrl,
                                                        uploaded_at: new Date().toISOString()
                                                    });
                                                }
                                            }
                                            const combined = [...xrayUrls, ...newUrls];
                                            setXrayUrls(combined);
                                            // Persist to visits table immediately
                                            await (supabase as any).from('visits').update({ xray_urls: combined }).eq('id', visitId!);

                                            toast({ title: `${newUrls.length} image${newUrls.length > 1 ? 's' : ''} uploaded`, description: 'X-rays saved to this visit record.' });
                                        } catch (error: any) {
                                            console.error('Upload error:', error);
                                            toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
                                        } finally {
                                            setUploading(false);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        {diagnosisLockedAt && xrayUrls.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                                <Lock className="inline w-3 h-3 mr-1" />
                                Diagnosis saved — X-ray images are locked for this visit.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setIsXrayModalOpen(false)} className="w-full sm:w-auto">
                            {diagnosisLockedAt ? 'Close' : 'Done'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Pins & Posts Count Modal */}
            <Dialog open={isPinsPostsModalOpen} onOpenChange={setIsPinsPostsModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Pins and Posts</DialogTitle>
                        <DialogDescription>
                            Enter the number of posts/pins for this procedure.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 flex flex-col items-center gap-4">
                        <Label className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Number of Posts</Label>
                        <div className="flex items-center gap-6">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 rounded-full border-2 border-slate-200 hover:border-primary hover:text-primary transition-colors"
                                onClick={() => setPinsPostsCount(Math.max(1, pinsPostsCount - 1))}
                            >
                                <span className="text-xl font-bold">−</span>
                            </Button>
                            <span className="text-5xl font-black text-primary w-16 text-center tabular-nums">{pinsPostsCount}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 rounded-full border-2 border-slate-200 hover:border-primary hover:text-primary transition-colors"
                                onClick={() => setPinsPostsCount(pinsPostsCount + 1)}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 bg-slate-100 px-3 py-1 rounded-full font-medium">
                            Total Benefit Multiplier: <span className="font-bold text-slate-900">{pinsPostsCount}x</span>
                        </p>
                    </div>
                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsPinsPostsModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
                        <Button onClick={handleConfirmPinsPosts} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white px-8 shadow-md">
                            Add to Bill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
