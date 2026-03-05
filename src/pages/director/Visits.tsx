import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Loader2, Download, Calendar as CalendarIcon, Image as ImageIcon, Search, Activity, CheckCircle2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

interface Visit {
    id: string;
    created_at: string;
    status: string;
    diagnosis: string | null;
    treatment_notes: string | null;
    benefit_deducted: number;
    branch_compensation: number;
    profit_loss: number;
    notes: string | null;
    members: { full_name: string; member_number: string } | null;
    branches: { name: string } | null;
    receptionist: { full_name: string } | null;
    doctor: { full_name: string } | null;
    periodontal_status: string[] | null;
    xray_urls: string[] | null;
    bills: {
        total_benefit_cost: number;
        total_branch_compensation: number;
        total_profit_loss: number;
        bill_items: {
            service_name: string;
            current_stage?: number;
            total_stages?: number;
        }[]
    }[] | null;
}

export default function DirectorVisits() {
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [branchId, setBranchId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchBranchAndVisits();
    }, [date, searchQuery]);

    async function fetchBranchAndVisits() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: staffData } = await supabase
                .from("staff")
                .select("branch_id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (staffData?.branch_id) {
                setBranchId(staffData.branch_id);
                await loadVisits(staffData.branch_id);
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    const loadVisits = async (bId: string) => {
        let query = (supabase as any)
            .from("visits")
            .select(`
        id,
        created_at,
        status,
        diagnosis,
        treatment_notes,
        benefit_deducted,
        branch_compensation,
        profit_loss,
        notes,
        periodontal_status,
        xray_urls,
        members(full_name, member_number), 
        branches(name), 
        doctor:doctor_id(full_name), 
        receptionist:receptionist_id(full_name), 
        bills(
          total_benefit_cost, 
          total_branch_compensation, 
          total_profit_loss, 
          bill_items(
            service_name
          )
        )
      `)
            .eq("branch_id", bId)
            .order("created_at", { ascending: false });

        if (date?.from) {
            const fromDate = new Date(date.from);
            fromDate.setHours(0, 0, 0, 0);
            query = query.gte("created_at", fromDate.toISOString());
        }
        if (date?.to) {
            const toDate = new Date(date.to);
            toDate.setHours(23, 59, 59, 999);
            query = query.lte("created_at", toDate.toISOString());
        }

        if (searchQuery) {
            // Since we can't easily search in joined tables with simple eq, 
            // we'll filter client-side if needed or use a more complex query if the DB allows
            // For now, let's just fetch and we'll refine if the user wants patient-specific search
        }

        const { data, error } = await query;

        if (error) {
            toast({ title: "Error loading visits", description: error.message, variant: "destructive" });
        } else {
            let filteredData = data || [];
            if (searchQuery) {
                filteredData = filteredData.filter((v: any) =>
                    v.members?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.members?.member_number?.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }
            setVisits(filteredData as any);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "arrived":
            case "registered":
                return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">Arrived</Badge>;
            case "in_progress":
            case "with_doctor":
                return <Badge className="bg-amber-50 text-amber-700 border-amber-100 italic flex items-center gap-1 w-fit">
                    <Activity className="h-3 w-3 animate-pulse" /> In Progress
                </Badge>;
            case "completed":
            case "billed":
                return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-1 w-fit">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                </Badge>;
            case "cancelled":
                return <Badge variant="destructive" className="opacity-70">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status.replace('_', ' ')}</Badge>;
        }
    };

    const activeVisits = visits.filter(v => v.status !== 'completed' && v.status !== 'cancelled' && v.status !== 'billed');
    const pastVisits = visits.filter(v => v.status === 'completed' || v.status === 'billed' || v.status === 'cancelled');

    const exportVisits = () => {
        const exportData = visits.map((visit) => ({
            Date: format(new Date(visit.created_at), "yyyy-MM-dd"),
            Time: format(new Date(visit.created_at), "HH:mm"),
            Patient: visit.members?.full_name || "",
            MemberNumber: visit.members?.member_number || "",
            Status: visit.status,
            Diagnosis: visit.diagnosis || "",
            TreatmentNotes: visit.treatment_notes || "",
            BenefitUsed: visit.benefit_deducted,
            BranchCompensation: visit.branch_compensation,
        }));

        exportToCsv(`branch_visits_${format(new Date(), "yyyyMMdd")}`, exportData);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-serif font-bold tracking-tight text-slate-900 font-bold">Patient Visits</h2>
                    <p className="text-slate-500">Comprehensive overview of active and past patient visits in your branch.</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-grow md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search patient or ID..."
                            className="pl-9 h-10 border-slate-200 shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="gap-2 h-10 border-slate-200 shadow-sm bg-white">
                                <CalendarIcon className="w-4 h-4 text-blue-500" />
                                {date?.from ? (
                                    date.to ? (
                                        `${format(date.from, "MMM dd")} - ${format(date.to, "MMM dd")}`
                                    ) : (
                                        format(date.from, "MMM dd, yyyy")
                                    )
                                ) : (
                                    "Filter by date"
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="range"
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" className="gap-2 h-10 border-slate-200 shadow-sm bg-white text-emerald-700 hover:bg-emerald-50" onClick={exportVisits}>
                        <Download className="w-4 h-4" /> Export
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 shadow-sm border p-1 bg-slate-100/50">
                    <TabsTrigger value="active" className="rounded-md flex items-center gap-2">
                        <Activity className="h-4 w-4" /> Active ({activeVisits.length})
                    </TabsTrigger>
                    <TabsTrigger value="past" className="rounded-md flex items-center gap-2">
                        <Clock className="h-4 w-4" /> History ({pastVisits.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                    <VisitTable visits={activeVisits} loading={loading} onSelect={(v) => { setSelectedVisit(v); setDetailsOpen(true); }} getStatusBadge={getStatusBadge} />
                </TabsContent>

                <TabsContent value="past">
                    <VisitTable visits={pastVisits} loading={loading} onSelect={(v) => { setSelectedVisit(v); setDetailsOpen(true); }} getStatusBadge={getStatusBadge} />
                </TabsContent>
            </Tabs>

            {/* Details Modal */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl uppercase shadow-sm">
                                {selectedVisit?.members?.full_name?.charAt(0)}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold text-slate-900">{selectedVisit?.members?.full_name}</DialogTitle>
                                <p className="text-sm text-slate-500 font-medium">Treatment Record for {selectedVisit && format(new Date(selectedVisit.created_at), "MMMM d, yyyy")}</p>
                            </div>
                        </div>
                    </DialogHeader>

                    {selectedVisit && (
                        <div className="space-y-8 mt-4">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-slate-50 border shadow-inner">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">ID Number</Label>
                                    <p className="font-bold text-slate-800">{selectedVisit.members?.member_number}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Arrived At</Label>
                                    <p className="font-bold text-slate-800">{format(new Date(selectedVisit.created_at), "HH:mm")}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Attending Doctor</Label>
                                    <p className="font-bold text-slate-800">{selectedVisit.doctor?.full_name || "Unassigned"}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Status</Label>
                                    <div>{getStatusBadge(selectedVisit.status)}</div>
                                </div>
                            </div>

                            {/* Clinical Details */}
                            <div className="grid lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 flex items-center gap-2">
                                            <History className="w-5 h-5 text-blue-600" /> Diagnosis & Clinical Notes
                                        </h3>

                                        {selectedVisit.periodontal_status && selectedVisit.periodontal_status.length > 0 && (
                                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                                <Label className="text-[10px] uppercase font-black text-blue-500 tracking-widest">Clinical Observations</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {selectedVisit.periodontal_status.map((s, idx) => (
                                                        <Badge key={idx} variant="outline" className="bg-white text-blue-700 border-blue-200 font-bold uppercase text-[9px]">
                                                            {s.replace('_', ' ')}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500">Current Diagnosis</Label>
                                            <div className="p-4 rounded-xl bg-slate-100/50 border min-h-[80px] text-sm text-slate-700 leading-relaxed shadow-sm">
                                                {selectedVisit.diagnosis || "No specific diagnosis recorded yet."}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500">Proposed Treatment / Progress Notes</Label>
                                            <div className="p-4 rounded-xl bg-slate-50 border min-h-[80px] text-sm italic text-slate-600 leading-relaxed shadow-sm">
                                                {selectedVisit.treatment_notes || "Ongoing consultation notes will appear here."}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="font-bold text-lg text-slate-800 border-b pb-2 flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5 text-purple-600" /> Diagnostic Imaging
                                    </h3>
                                    {selectedVisit.xray_urls && selectedVisit.xray_urls.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            {selectedVisit.xray_urls.map((url, idx) => (
                                                <div key={idx} className="aspect-square rounded-2xl border-2 border-slate-200 overflow-hidden shadow-md group relative">
                                                    <img src={url} alt={`X-ray ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                                        <Button variant="secondary" size="sm" className="font-bold" onClick={() => window.open(url, '_blank')}>View HD</Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl text-slate-400 bg-white shadow-inner">
                                            <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No radiological scans available.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Services & Billing */}
                            <div className="space-y-6 pt-6 border-t">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-emerald-600" /> Procedures & Final Compensation
                                </h3>

                                {selectedVisit.bills && selectedVisit.bills.length > 0 ? (
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                            <Label className="text-xs font-bold text-slate-400 uppercase">Total Billable</Label>
                                            <p className="text-2xl font-black text-slate-900 mt-1">KES {selectedVisit.bills[0].total_benefit_cost.toLocaleString()}</p>
                                        </div>
                                        <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                                            <Label className="text-xs font-bold text-emerald-600/70 uppercase">Branch Revenue</Label>
                                            <p className="text-2xl font-black text-emerald-700 mt-1">KES {selectedVisit.bills[0].total_branch_compensation.toLocaleString()}</p>
                                        </div>
                                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                            <Label className="text-xs font-bold text-slate-400 uppercase">Operating Margin</Label>
                                            <p className={cn(
                                                "text-2xl font-black mt-1",
                                                selectedVisit.bills[0].total_profit_loss >= 0 ? "text-blue-700" : "text-red-600"
                                            )}>
                                                KES {selectedVisit.bills[0].total_profit_loss.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center border rounded-2xl border-dashed text-slate-400 font-medium">
                                        Billing will be finalized upon treatment completion.
                                    </div>
                                )}

                                {selectedVisit.bills?.[0]?.bill_items && selectedVisit.bills[0].bill_items.length > 0 && (
                                    <div className="space-y-3">
                                        <Label className="text-sm font-black text-slate-800 uppercase tracking-tight">Procedures Performed:</Label>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {selectedVisit.bills[0].bill_items.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white border shadow-sm group hover:border-blue-300 transition-colors">
                                                    <span className="font-bold text-slate-700">{item.service_name}</span>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">Verified</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function VisitTable({ visits, loading, onSelect, getStatusBadge }: any) {
    if (loading) return <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-slate-400 font-medium animate-pulse">Scanning clinical records...</p>
    </div>;

    if (visits.length === 0) return (
        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-slate-50 text-slate-400">
            <History className="h-12 w-12 mb-3 opacity-10" />
            <p className="font-bold">No visit records found in this category.</p>
        </div>
    );

    return (
        <Card className="shadow-xl border-none overflow-hidden rounded-3xl">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50/80">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="py-5 font-bold text-slate-600">Patient Identity</TableHead>
                            <TableHead className="py-5 font-bold text-slate-600">Arrived</TableHead>
                            <TableHead className="py-5 font-bold text-slate-600">Practitioner</TableHead>
                            <TableHead className="py-5 font-bold text-slate-600">Current Status</TableHead>
                            <TableHead className="py-5 font-bold text-slate-600">Total Bill</TableHead>
                            <TableHead className="py-5 font-bold text-right text-slate-600 pr-8">Context</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visits.map((visit: any) => (
                            <TableRow key={visit.id} className="group hover:bg-slate-50/50 transition-colors border-b-slate-100">
                                <TableCell className="py-6">
                                    <div className="flex items-center gap-3 pl-2">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shadow-sm border group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            {visit.members?.full_name?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 leading-tight">{visit.members?.full_name}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">ID: {visit.members?.member_number}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-bold text-slate-700">{format(new Date(visit.created_at), "MMM d")}</div>
                                    <div className="text-[10px] font-black text-blue-500 uppercase">{format(new Date(visit.created_at), "HH:mm")} HRS</div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-bold text-slate-800">{visit.doctor?.full_name || "Unassigned"}</div>
                                    <div className="text-[10px] font-medium text-slate-400 italic">Medical Officer</div>
                                </TableCell>
                                <TableCell>{getStatusBadge(visit.status)}</TableCell>
                                <TableCell>
                                    <div className="font-black text-slate-900">KES {visit.benefit_deducted.toLocaleString()}</div>
                                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Verified Claim</div>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl px-4 font-black text-xs hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                        onClick={() => onSelect(visit)}
                                    >
                                        Clinical File
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
