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
import { History, Loader2, Download, Calendar as CalendarIcon, Trash2, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export default function AdminVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadVisits();
  }, [date]); // Reload when date changes

  const loadVisits = async () => {
    setLoading(true);
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
      .order("created_at", { ascending: false });

    if (date?.from) {
      // Set start time to beginning of the day
      const fromDate = new Date(date.from);
      fromDate.setHours(0, 0, 0, 0);
      query = query.gte("created_at", fromDate.toISOString());
    }
    if (date?.to) {
      // Set end time to end of the day
      const toDate = new Date(date.to);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte("created_at", toDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error loading visits",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setVisits((data || []) as any);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return <Badge variant="secondary">Registered</Badge>;
      case "with_doctor":
        return <Badge className="bg-blue-500/10 text-blue-600">With Doctor</Badge>;
      case "billed":
        return <Badge className="bg-orange-500/10 text-orange-600">Billed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deleteVisit = async (visitId: string) => {
    const { error } = await (supabase as any).from("visits").delete().eq("id", visitId);
    if (error) {
      toast({ title: "Error deleting visit", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Visit deleted" });
      loadVisits();
    }
  };

  const exportVisits = () => {
    const exportData = visits.map((visit) => ({
      Date: format(new Date(visit.created_at), "yyyy-MM-dd"),
      Time: format(new Date(visit.created_at), "HH:mm"),
      Patient: visit.members?.full_name || "",
      MemberNumber: visit.members?.member_number || "",
      Branch: visit.branches?.name || "",
      Status: visit.status,
      Diagnosis: visit.diagnosis || "",
      TreatmentNotes: visit.treatment_notes || "",
      PeriodontalStatus: visit.periodontal_status?.join(", ") || "",
      BenefitDeducted: visit.benefit_deducted,
      BranchCompensation: visit.branch_compensation,
      ProfitLoss: visit.profit_loss,
    }));

    exportToCsv(`visits_${format(new Date(), "yyyyMMdd")}`, exportData);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Visits</h2>
          <p className="text-muted-foreground">Manage and review all patient visits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
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
          <Button variant="outline" className="gap-2" onClick={exportVisits}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Visit Records</CardTitle>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Benefit Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>
                      <div className="font-medium">{format(new Date(visit.created_at), "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(visit.created_at), "HH:mm")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{visit.members?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{visit.members?.member_number}</div>
                    </TableCell>
                    <TableCell>{visit.branches?.name}</TableCell>
                    <TableCell>{getStatusBadge(visit.status)}</TableCell>
                    <TableCell className="font-medium">KES {visit.benefit_deducted.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => {
                          setSelectedVisit(visit);
                          setDetailsOpen(true);
                        }}
                      >
                        View
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Visit</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the visit.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteVisit(visit.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Visit Details</DialogTitle>
          </DialogHeader>

          {selectedVisit && (
            <div className="space-y-8">
              {/* Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-6 rounded-xl bg-slate-50 border shadow-sm">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Patient</Label>
                  <p className="font-bold text-slate-900">{selectedVisit.members?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedVisit.members?.member_number}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Date & Time</Label>
                  <p className="font-bold text-slate-900">{format(new Date(selectedVisit.created_at), "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(selectedVisit.created_at), "HH:mm")}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Branch</Label>
                  <p className="font-bold text-slate-900">{selectedVisit.branches?.name}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedVisit.status)}</div>
                </div>
              </div>

              {/* Clinical Details */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" /> Clinical Assessment
                    </h3>

                    {selectedVisit.periodontal_status && selectedVisit.periodontal_status.length > 0 && (
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <Label className="text-[10px] uppercase font-bold text-primary">Periodontal Status</Label>
                        <p className="font-bold text-primary">
                          {selectedVisit.periodontal_status
                            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(", ")}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs font-bold text-muted-foreground">Diagnosis</Label>
                      <div className="mt-1 p-3 rounded-lg bg-slate-50 border min-h-[60px] text-sm">
                        {selectedVisit.diagnosis || "No diagnosis recorded."}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-muted-foreground">Treatment Notes</Label>
                      <div className="mt-1 p-3 rounded-lg bg-slate-50 border min-h-[60px] text-sm italic">
                        {selectedVisit.treatment_notes || "No treatment notes."}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg border-b pb-2">Medical Staff</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border bg-slate-50/50">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Attending Doctor</Label>
                        <p className="font-medium">{selectedVisit.doctor?.full_name || "N/A"}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-slate-50/50">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Receptionist</Label>
                        <p className="font-medium">{selectedVisit.receptionist?.full_name || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-primary" /> Radiographs (X-Rays)
                  </h3>
                  {selectedVisit.xray_urls && selectedVisit.xray_urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedVisit.xray_urls.map((url, idx) => (
                        <Dialog key={idx}>
                          <DialogTrigger asChild>
                            <div className="aspect-square rounded-xl border-2 border-slate-200 overflow-hidden cursor-zoom-in hover:border-primary transition-all shadow-sm group relative">
                              <img src={url} alt={`X-ray ${idx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-white text-xs font-bold">View Larger</span>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-5xl p-0 bg-black border-0">
                            <img src={url} className="max-h-[90vh] w-auto mx-auto object-contain" alt="X-ray viewing" />
                          </DialogContent>
                        </Dialog>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50">
                      <ImageIcon className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm">No X-rays uploaded for this visit.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Services & Billing */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">Services & Billing Summary</h3>

                {selectedVisit.bills && selectedVisit.bills.length > 0 ? (
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border">
                      <Label className="text-xs font-bold text-muted-foreground">Total Benefit Used</Label>
                      <p className="text-2xl font-bold text-primary">KES {selectedVisit.bills[0].total_benefit_cost.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border">
                      <Label className="text-xs font-bold text-muted-foreground">Branch Compensation</Label>
                      <p className="text-2xl font-bold text-green-700">KES {selectedVisit.bills[0].total_branch_compensation.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border">
                      <Label className="text-xs font-bold text-muted-foreground">Profit / Loss</Label>
                      <p className={cn(
                        "text-2xl font-bold",
                        selectedVisit.bills[0].total_profit_loss >= 0 ? "text-emerald-700" : "text-red-600"
                      )}>
                        KES {selectedVisit.bills[0].total_profit_loss.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No billing information found for this visit.</p>
                )}

                {selectedVisit.bills && selectedVisit.bills[0]?.bill_items && selectedVisit.bills[0].bill_items.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-bold">Services Provided</Label>
                    <ul className="mt-2 space-y-2">
                      {selectedVisit.bills[0].bill_items.map((item, idx) => (
                        <li key={idx} className="p-3 rounded-lg bg-slate-50 border text-sm">
                          {item.service_name}
                        </li>
                      ))}
                    </ul>
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