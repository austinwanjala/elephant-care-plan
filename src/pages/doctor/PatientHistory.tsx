import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, User, History, Loader2, ArrowLeft, Stethoscope, FileText, CalendarDays, Camera, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { DentalChart, DentalChartMode } from "@/components/doctor/DentalChart";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Image as ImageIcon, Stethoscope as DiagnosisIcon, ClipboardList } from "lucide-react";

export default function DoctorPatientHistory() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [visits, setVisits] = useState<any[]>([]);
    const [activeStages, setActiveStages] = useState<any[]>([]);
    const [dentalRecords, setDentalRecords] = useState<Record<number, string>>({});
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
    const [selectedDependant, setSelectedDependant] = useState<any>(null);
    const { toast } = useToast();

    const getStageName = (service: any, stageNum: number) => {
        if (service?.stage_names && service.stage_names[stageNum - 1]) {
            return service.stage_names[stageNum - 1];
        }
        return `Stage ${stageNum}`;
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm) return;
        setSearching(true);
        setMember(null);
        setVisits([]);
        setDentalRecords({});

        try {
            // 1. Search Members
            const { data: memberMatches } = await supabase
                .from("members")
                .select("*, membership_categories(name), branches(name)")
                .or(`phone.ilike."%${searchTerm}%",id_number.ilike."%${searchTerm}%",member_number.ilike."%${searchTerm}%",full_name.ilike."%${searchTerm}%"`);

            // 2. Search Dependants
            const { data: dependantMatches } = await supabase
                .from("dependants")
                .select("*, members(*, membership_categories(name), branches(name))")
                .or(`full_name.ilike."%${searchTerm}%",id_number.ilike."%${searchTerm}%"`);

            const combinedResults = [
                ...(memberMatches || []).map(m => ({ ...m, resultType: 'principal' })),
                ...(dependantMatches || []).map(d => ({
                    ...d,
                    resultType: 'dependant',
                    principalData: d.members,
                    dependentName: d.full_name
                }))
            ];

            if (combinedResults.length > 1) {
                setSearchResults(combinedResults);
                setSelectionDialogOpen(true);
            } else if (combinedResults.length === 1) {
                handleSelectMember(combinedResults[0]);
            } else {
                toast({ title: "No matches found", description: "No member or dependant found matching that criteria.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Search failed", description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const handleSelectMember = async (result: any) => {
        setSelectionDialogOpen(false);
        if (result.resultType === 'dependant') {
            setMember(result.principalData);
            setSelectedDependant(result);
            fetchMemberHistory(result.member_id, result.id);
        } else {
            setMember(result);
            setSelectedDependant(null);
            fetchMemberHistory(result.id, null);
        }
    };

    const fetchMemberHistory = async (memberId: string, dependantId: string | null = null) => {
        // Fetch visits with clinical details
        let visitsQuery = (supabase as any)
            .from("visits")
            .select(`
                *, 
                branches(name), 
                doctor:doctor_id(full_name), 
                dependants(full_name),
                bills(
                    total_benefit_cost, 
                    bill_items(service_name)
                ),
                service_stages(*, services(name, stage_names))
            `)
            .eq("member_id", memberId);

        if (dependantId) {
            visitsQuery = visitsQuery.eq("dependant_id", dependantId);
        } else {
            visitsQuery = visitsQuery.is("dependant_id", null);
        }

        const { data: visitsData, error: visitsError } = await visitsQuery.order("created_at", { ascending: false });

        if (visitsError) {
            toast({ title: "Error fetching visits", description: visitsError.message, variant: "destructive" });
        } else {
            setVisits(visitsData || []);
        }

        // Fetch dental records
        let dentalQuery = (supabase as any)
            .from("dental_records")
            .select("tooth_number, status")
            .eq("member_id", memberId);

        if (dependantId) {
            dentalQuery = dentalQuery.eq("dependant_id", dependantId);
        } else {
            dentalQuery = dentalQuery.is("dependant_id", null);
        }

        const { data: dentalRecordsData, error: dentalRecordsError } = await dentalQuery;

        if (dentalRecordsError) {
            toast({ title: "Error fetching dental records", description: dentalRecordsError.message, variant: "destructive" });
        } else {
            const recordsMap: Record<number, string> = {};
            (dentalRecordsData || []).forEach(record => {
                recordsMap[record.tooth_number] = record.status;
            });
            setDentalRecords(recordsMap);
        }

        // Fetch active stages
        let stagesQuery = (supabase as any)
            .from("service_stages")
            .select("*, services(name, stage_names)")
            .eq("member_id", memberId)
            .eq("status", "in_progress");

        if (dependantId) {
            stagesQuery = stagesQuery.eq("dependant_id", dependantId);
        } else {
            stagesQuery = stagesQuery.is("dependant_id", null);
        }

        const { data: stagesData } = await stagesQuery;

        if (stagesData) {
            setActiveStages(stagesData);
        }
    };

    const calculateAge = (dob: string) => {
        if (!dob) return 0;
        const diffMs = Date.now() - new Date(dob).getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    };

    let chartMode: DentalChartMode = 'adult';
    if (selectedDependant?.dob || member?.dob) {
        const age = calculateAge(selectedDependant?.dob || member.dob);
        if (age <= 14) chartMode = 'mixed';
        else chartMode = 'adult';
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/doctor">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Patient History</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Patient Lookup</CardTitle>
                    <CardDescription>Enter Phone Number, National ID, or Member Number to view patient history.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <Input
                            placeholder="Phone, ID, or Member Number"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="submit" disabled={searching}>
                            {searching ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Search</span>
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {member && (
                <div className="space-y-6">
                    <Card className="border-primary/50">
                        <CardHeader className="bg-primary/5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle>{selectedDependant ? selectedDependant.full_name : member.full_name}</CardTitle>
                                        {selectedDependant && <Badge variant="secondary" className="bg-blue-50 text-blue-700">Dependant</Badge>}
                                    </div>
                                    <CardDescription>
                                        {selectedDependant ? `Dependent of ${member.full_name}` : `Member #${member.member_number}`}
                                    </CardDescription>
                                </div>
                                <Badge variant={member.is_active ? "default" : "destructive"}>
                                    {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <Label className="text-muted-foreground">Phone</Label>
                                <p className="font-medium">{member.phone}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">ID Number</Label>
                                <p className="font-medium">{member.id_number}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Coverage Balance</Label>
                                <p className="font-medium text-primary">KES {member.coverage_balance?.toLocaleString()}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Membership</Label>
                                <p className="font-medium">{member.membership_categories?.name || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Stethoscope className="h-5 w-5" /> Dental Chart History
                            </CardTitle>
                            <CardDescription>Current and historical dental records for {selectedDependant ? selectedDependant.full_name : member.full_name}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DentalChart
                                onToothClick={() => { }} // Not interactive in history view
                                selectedTeeth={[]}
                                toothStatus={dentalRecords}
                                toothStages={activeStages.reduce((acc, s) => {
                                    if (s.tooth_number) {
                                        acc[s.tooth_number] = { current: s.current_stage, total: s.total_stages };
                                    }
                                    return acc;
                                }, {} as Record<number, { current: number, total: number }>)}
                                mode={chartMode}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" /> Visit History
                            </CardTitle>
                            <CardDescription>Past completed visits and services provided.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {visits.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No past visits found for this member.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[600px] divide-y divide-border">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground">
                                                <th className="py-3 pr-3 font-semibold">Date</th>
                                                <th className="py-3 px-3 font-semibold">Patient</th>
                                                <th className="py-3 px-3 font-semibold">Clinical Info</th>
                                                <th className="py-3 px-3 font-semibold">Status</th>
                                                <th className="py-3 pl-3 font-semibold text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {visits.map(visit => (
                                                <tr key={visit.id} className="hover:bg-muted/50">
                                                    <td className="py-3 pr-3 text-sm">
                                                        <div className="font-medium">{format(new Date(visit.created_at), 'MMM d, yyyy')}</div>
                                                        <div className="text-[10px] text-muted-foreground">{visit.branches?.name}</div>
                                                    </td>
                                                    <td className="py-3 px-3 text-sm">
                                                        <div>{visit.dependants?.full_name || 'Principal'}</div>
                                                        <div className="text-[10px] text-muted-foreground">Dr. {visit.doctor?.full_name || 'N/A'}</div>
                                                    </td>
                                                    <td className="py-3 px-3 text-sm max-w-[320px]">
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap gap-1">
                                                                {/* Show Bill Items */}
                                                                {visit.bills?.[0]?.bill_items?.map((item: any, idx: number) => (
                                                                    <Badge key={idx} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                                                        {item.service_name}
                                                                    </Badge>
                                                                ))}
                                                                {/* Show Stages Specifically with Blue Theme */}
                                                                {visit.service_stages?.map((stage: any, idx: number) => (
                                                                    <Badge key={`stage-${idx}`} variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-blue-200 bg-blue-50 text-blue-700 font-bold">
                                                                        {stage.tooth_number ? `Tooth #${stage.tooth_number}` : 'General'} • {getStageName(stage.services, stage.current_stage)}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                            {visit.diagnosis && (
                                                                <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-orange-50/50 p-1 px-2 rounded border border-orange-100 italic">
                                                                    <DiagnosisIcon className="w-3 h-3 mt-0.5 text-orange-500" />
                                                                    <span className="truncate">{visit.diagnosis}</span>
                                                                </div>
                                                            )}
                                                            {visit.xray_urls && visit.xray_urls.length > 0 && (
                                                                <div className="flex gap-2 pt-1 items-center">
                                                                    <div className="flex -space-x-2">
                                                                        {visit.xray_urls.slice(0, 3).map((url: string, idx: number) => (
                                                                            <div key={idx} className="h-7 w-7 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm hover:z-10 transition-transform hover:scale-110">
                                                                                <img src={url} alt="X-ray" className="h-full w-full object-cover" />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {visit.xray_urls.length > 3 && (
                                                                        <span className="text-[10px] text-muted-foreground font-medium pl-1">+{visit.xray_urls.length - 3}</span>
                                                                    )}
                                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 bg-blue-50 text-blue-600 border-blue-100 flex items-center gap-1 font-semibold">
                                                                        <Camera className="w-2.5 h-2.5" /> {visit.xray_urls.length} Radiographs
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-sm">
                                                        <Badge
                                                            variant={visit.status === 'completed' ? 'default' : 'outline'}
                                                            className={cn(
                                                                "capitalize text-[10px] px-2 h-5",
                                                                visit.status === 'completed' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                                            )}
                                                        >
                                                            {visit.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 pl-3 text-sm text-right">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="default" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-xs gap-2 shadow-sm">
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    View Details
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                                                <DialogHeader>
                                                                    <DialogTitle className="flex items-center gap-2">
                                                                        <DiagnosisIcon className="w-5 h-5 text-primary" />
                                                                        Clinical Record - {format(new Date(visit.created_at), 'PPP')}
                                                                    </DialogTitle>
                                                                    <DialogDescription>Full medical details for this visit.</DialogDescription>
                                                                </DialogHeader>

                                                                <div className="space-y-6 pt-4">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="p-3 bg-muted/30 rounded-lg">
                                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Patient</Label>
                                                                            <p className="font-medium text-sm">{visit.dependants?.full_name || member.full_name}</p>
                                                                        </div>
                                                                        <div className="p-3 bg-muted/30 rounded-lg">
                                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Provider/Location</Label>
                                                                            <p className="font-medium text-sm">Dr. {visit.doctor?.full_name} @ {visit.branches?.name}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label className="flex items-center gap-2 text-primary font-bold"><DiagnosisIcon className="w-4 h-4" /> Diagnosis</Label>
                                                                        <div className="p-4 bg-white border rounded-lg text-sm leading-relaxed">
                                                                            {visit.diagnosis || 'No clinical diagnosis recorded.'}
                                                                        </div>
                                                                    </div>

                                                                    {visit.treatment_notes && (
                                                                        <div className="space-y-2">
                                                                            <Label className="flex items-center gap-2 text-primary font-bold"><ClipboardList className="w-4 h-4" /> Treatment Notes</Label>
                                                                            <div className="p-4 bg-white border rounded-lg text-sm leading-relaxed">
                                                                                {visit.treatment_notes}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {visit.service_stages && visit.service_stages.length > 0 && (
                                                                        <div className="space-y-2">
                                                                            <Label className="font-bold flex items-center gap-2"><History className="w-4 h-4" /> Procedures & Stages</Label>
                                                                            <div className="space-y-2">
                                                                                {visit.service_stages.map((stage: any) => (
                                                                                    <div key={stage.id} className="flex justify-between items-center p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                                                                        <div>
                                                                                            <span className="font-medium text-sm">
                                                                                                {stage.tooth_number ? `Tooth #${stage.tooth_number}` : 'General'}
                                                                                            </span>
                                                                                            <p className="text-[10px] text-muted-foreground">Performing {getStageName(stage.services, stage.current_stage)} of {stage.total_stages}</p>
                                                                                        </div>
                                                                                        <Badge className="bg-blue-600">{getStageName(stage.services, stage.current_stage)}</Badge>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {visit.xray_urls && visit.xray_urls.length > 0 && (
                                                                        <div className="space-y-2">
                                                                            <Label className="flex items-center gap-2 text-primary font-bold"><Camera className="w-4 h-4" /> Radiographs (X-Rays)</Label>
                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                                {visit.xray_urls.map((url: string, idx: number) => (
                                                                                    <Dialog key={idx}>
                                                                                        <DialogTrigger asChild>
                                                                                            <div className="cursor-pointer group relative aspect-square rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all">
                                                                                                <img src={url} alt="X-ray" className="h-full w-full object-cover" />
                                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                                    <ImageIcon className="text-white w-6 h-6" />
                                                                                                </div>
                                                                                            </div>
                                                                                        </DialogTrigger>
                                                                                        <DialogContent className="max-w-4xl p-0 bg-black border-0">
                                                                                            <img src={url} alt="Full resolution X-ray" className="w-full max-h-[90vh] object-contain" />
                                                                                        </DialogContent>
                                                                                    </Dialog>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
            <Dialog open={selectionDialogOpen} onOpenChange={setSelectionDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Select Patient</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">Multiple matches found. Please select the correct patient to view history.</p>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {searchResults.map((m) => (
                                <div
                                    key={m.resultType === 'dependant' ? `dep-${m.id}` : `mem-${m.id}`}
                                    className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors flex justify-between items-center group"
                                    onClick={() => handleSelectMember(m)}
                                >
                                    <div>
                                        <div className="font-bold group-hover:text-primary transition-colors">
                                            {m.full_name}
                                            {m.resultType === 'dependant' && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Dependant</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {m.resultType === 'dependant'
                                                ? `Dep. of ${m.principalData?.full_name} (#${m.principalData?.member_number})`
                                                : `#${m.member_number} • ${m.phone} • ${m.id_number}`
                                            }
                                        </div>
                                        <div className="text-[10px] mt-1 text-primary/70">
                                            {m.membership_categories?.name || m.principalData?.membership_categories?.name} @ {m.branches?.name || m.principalData?.branches?.name}
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}