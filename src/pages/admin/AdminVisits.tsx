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
import {
  History,
  Loader2,
  Download,
  Calendar as CalendarIcon,
  Trash2,
  Eye,
  X,
  User,
  Stethoscope,
  ClipboardList,
  Image as ImageIcon,
  Receipt,
  Building2,
  UserCheck,
  ZoomIn,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BillItem {
  service_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  benefit_cost: number;
  branch_compensation: number;
  tooth_number: string | null;
}

interface Bill {
  id: string;
  total_benefit_cost: number;
  total_branch_compensation: number;
  total_profit_loss: number;
  is_claimable: boolean;
  payment_status: string;
  bill_items: BillItem[];
}

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
  members: { full_name: string; member_number: string; id_number: string } | null;
  dependants: { full_name: string; document_number: string } | null;
  branches: { name: string } | null;
  receptionist: { full_name: string } | null;
  doctor: { full_name: string } | null;
  xray_urls: string[] | null;
  bills: Bill[] | null;
}

export default function AdminVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadVisits();
  }, [date]);

  const loadVisits = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("visits")
      .select(`
        *,
        members(full_name, member_number, id_number),
        dependants(full_name, document_number),
        branches(name),
        doctor:doctor_id(full_name),
        receptionist:receptionist_id(full_name),
        xray_urls,
        bills(
          id,
          total_benefit_cost,
          total_branch_compensation,
          total_profit_loss,
          is_claimable,
          payment_status,
          bill_items(service_name, quantity, unit_cost, total_cost, benefit_cost, branch_compensation, tooth_number)
        )
      `)
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

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error loading visits", description: error.message, variant: "destructive" });
    } else {
      setVisits((data || []) as any);
    }
    setLoading(false);
  };

  const openDetails = (visit: Visit) => {
    setSelectedVisit(visit);
    setDetailsOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return <Badge variant="secondary">Registered</Badge>;
      case "with_doctor":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">With Doctor</Badge>;
      case "billed":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-200">Billed</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    try {
      const { error } = await supabase.from("visits").delete().eq("id", visitId);
      if (error) throw error;

      await supabase.from("system_logs").insert({
        action: "DELETE_VISIT",
        details: { visit_id: visitId, deleted_by: (await supabase.auth.getUser()).data.user?.id },
        user_id: (await supabase.auth.getUser()).data.user?.id
      });

      toast({ title: "Visit deleted", description: "The visit record has been permanently removed." });
      if (selectedVisit?.id === visitId) setDetailsOpen(false);
      loadVisits();
    } catch (error: any) {
      toast({ title: "Error deleting visit", description: error.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handleExport = () => {
    const dataToExport = visits.map(v => {
      const bill = v.bills?.[0];
      return {
        "Date": format(new Date(v.created_at), "yyyy-MM-dd HH:mm"),
        "Member Name": v.members?.full_name || "N/A",
        "Member Number": v.members?.member_number || "N/A",
        "Branch": v.branches?.name || "N/A",
        "Doctor": v.doctor?.full_name || "N/A",
        "Receptionist": v.receptionist?.full_name || "N/A",
        "Services": bill?.bill_items?.map((item: any) => item.service_name).join(", ") || "N/A",
        "Diagnosis": v.diagnosis || "N/A",
        "Status": v.status,
        "Benefit Deducted": bill?.total_benefit_cost || 0,
        "Branch Compensation": bill?.total_branch_compensation || 0,
        "Profit/Loss": bill?.total_profit_loss || 0
      };
    });
    exportToCsv("visits_export.csv", dataToExport);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">All Visits</h1>
          <p className="text-muted-foreground">Comprehensive record of all processed dental services</p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>{format(date.from, "LLL dd, y")} — {format(date.to, "LLL dd, y")}</>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Processed Services
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Benefit Deducted</TableHead>
                  <TableHead>Branch Comp.</TableHead>
                  <TableHead>Profit/Loss</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No visits recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => {
                    const bill = visit.bills?.[0];
                    const servicesList = bill?.bill_items?.map(item => item.service_name).join(", ") || "N/A";
                    const benefitDeducted = bill?.total_benefit_cost || 0;
                    const branchCompensation = bill?.total_branch_compensation || 0;
                    const profitLoss = bill?.total_profit_loss || 0;
                    const patientName = visit.dependants?.full_name || visit.members?.full_name;

                    return (
                      <TableRow key={visit.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(visit.created_at), "MMM d, yyyy")}
                          <div className="text-xs text-muted-foreground">{format(new Date(visit.created_at), "HH:mm")}</div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{patientName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {visit.members?.member_number}
                            </p>
                            {visit.dependants && (
                              <p className="text-[10px] text-muted-foreground italic">Dependant</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{visit.branches?.name || "N/A"}</TableCell>
                        <TableCell className="text-sm">{visit.doctor?.full_name || "N/A"}</TableCell>
                        <TableCell className="max-w-[160px]">
                          <span className="text-sm truncate block" title={servicesList}>
                            {servicesList}
                          </span>
                          {visit.xray_urls && visit.xray_urls.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium mt-0.5">
                              <ImageIcon className="h-3 w-3" />
                              {visit.xray_urls.length} X-ray{visit.xray_urls.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(visit.status || "unknown")}</TableCell>
                        <TableCell className="text-destructive font-medium">
                          -KES {benefitDeducted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-medium">
                          +KES {branchCompensation.toLocaleString()}
                        </TableCell>
                        <TableCell className={cn("font-medium", profitLoss >= 0 ? "text-emerald-600" : "text-destructive")}>
                          KES {profitLoss.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() => openDetails(visit)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(visit.id)}
                              title="Delete Visit"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Visit Details Dialog ─── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {selectedVisit && (() => {
            const bill = selectedVisit.bills?.[0];
            const patientName = selectedVisit.dependants?.full_name || selectedVisit.members?.full_name;
            const patientId = selectedVisit.dependants?.document_number || selectedVisit.members?.id_number;
            const benefitDeducted = bill?.total_benefit_cost || 0;
            const branchCompensation = bill?.total_branch_compensation || 0;
            const profitLoss = bill?.total_profit_loss || 0;

            return (
              <>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      Visit Details
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm">
                      Visit #{selectedVisit.id.slice(0, 8).toUpperCase()} &nbsp;•&nbsp;
                      {format(new Date(selectedVisit.created_at), "PPP p")}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(selectedVisit.status || "unknown")}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => { setDetailsOpen(false); setDeleteId(selectedVisit.id); }}
                      title="Delete this visit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-6 space-y-6">

                  {/* ── Patient & Staff Info ── */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Patient */}
                    <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
                      <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Patient
                      </p>
                      <div className="space-y-1">
                        <p className="font-bold text-lg leading-tight">{patientName}</p>
                        {selectedVisit.dependants && (
                          <p className="text-xs text-muted-foreground italic">
                            Dependant of {selectedVisit.members?.full_name} ({selectedVisit.members?.member_number})
                          </p>
                        )}
                        {!selectedVisit.dependants && (
                          <p className="text-xs font-mono text-muted-foreground">{selectedVisit.members?.member_number}</p>
                        )}
                        {patientId && (
                          <p className="text-xs text-muted-foreground">ID / Doc: {patientId}</p>
                        )}
                      </div>
                    </div>

                    {/* Staff */}
                    <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
                      <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" /> Staff
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2 items-center">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Doctor:</span>
                          <span className="font-semibold">{selectedVisit.doctor?.full_name || "N/A"}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Receptionist:</span>
                          <span className="font-semibold">{selectedVisit.receptionist?.full_name || "N/A"}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Branch:</span>
                          <span className="font-semibold">{selectedVisit.branches?.name || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Clinical Notes ── */}
                  <div className="rounded-xl border p-4 space-y-4">
                    <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" /> Clinical Notes
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnosis</p>
                        <p className="text-sm bg-slate-50 rounded-lg p-3 border leading-relaxed min-h-[60px]">
                          {selectedVisit.diagnosis || <span className="italic text-muted-foreground">No diagnosis recorded</span>}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Treatment Notes</p>
                        <p className="text-sm bg-slate-50 rounded-lg p-3 border leading-relaxed min-h-[60px]">
                          {selectedVisit.treatment_notes || <span className="italic text-muted-foreground">No treatment notes recorded</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Services & Billing ── */}
                  {bill && (
                    <div className="rounded-xl border overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                          Services & Billing
                        </p>
                        <div className="ml-auto">
                          <Badge variant="outline" className="text-[10px]">
                            {bill.payment_status === "paid" ? "Paid" : bill.payment_status === "pending" ? "Pending" : bill.payment_status}
                          </Badge>
                        </div>
                      </div>

                      {/* Bill Items */}
                      {bill.bill_items && bill.bill_items.length > 0 && (
                        <div className="divide-y">
                          {bill.bill_items.map((item, idx) => (
                            <div key={idx} className="px-4 py-3 flex justify-between items-start gap-4">
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold">{item.service_name}</p>
                                {item.tooth_number && (
                                  <p className="text-xs text-muted-foreground">Tooth #{item.tooth_number}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0 text-sm space-y-0.5">
                                <p className="font-semibold text-destructive">
                                  -KES {Number(item.benefit_cost || item.unit_cost || 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-emerald-600">
                                  Comp: KES {Number(item.branch_compensation || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Totals */}
                      <div className="bg-slate-50 border-t px-4 py-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Benefit Cost</span>
                          <span className="font-bold text-destructive">-KES {benefitDeducted.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Branch Compensation</span>
                          <span className="font-bold text-emerald-600">+KES {branchCompensation.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>Profit / Loss</span>
                          <span className={profitLoss >= 0 ? "text-emerald-600" : "text-destructive"}>
                            KES {profitLoss.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── X-Ray Images ── */}
                  {selectedVisit.xray_urls && selectedVisit.xray_urls.length > 0 && (
                    <div className="rounded-xl border p-4 space-y-3">
                      <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" /> Radiographs (X-Rays)
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {selectedVisit.xray_urls.length}
                        </Badge>
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {selectedVisit.xray_urls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightboxUrl(url)}
                            className="group relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200 hover:border-primary shadow-sm hover:shadow-md transition-all bg-slate-100"
                          >
                            <img
                              src={url}
                              alt={`X-ray ${idx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                              {idx + 1}/{selectedVisit.xray_urls!.length}
                            </div>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Click any image to view full size.</p>
                    </div>
                  )}

                  {/* No X-Rays */}
                  {(!selectedVisit.xray_urls || selectedVisit.xray_urls.length === 0) && (
                    <div className="rounded-xl border border-dashed p-6 flex flex-col items-center gap-2 text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No radiographic images were uploaded for this visit.</p>
                    </div>
                  )}

                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── X-Ray Lightbox ─── */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black border-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>X-Ray Full View</DialogTitle>
            <DialogDescription>Full resolution radiographic image</DialogDescription>
          </DialogHeader>
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxUrl && (
            <div className="flex items-center justify-center min-h-[50vh] max-h-[90vh]">
              <img
                src={lightboxUrl}
                alt="X-ray full view"
                className="max-h-[90vh] max-w-full w-auto object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the visit record and all associated billing information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDeleteVisit(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}