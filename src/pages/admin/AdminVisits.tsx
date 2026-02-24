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
  periodontal_status: string | null;
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
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDeleteVisit = async (visitId: string) => {
    try {
      const { error } = await supabase.from("visits").delete().eq("id", visitId);
      if (error) throw error;

      // Log the action
      const { error: logError } = await supabase.from("system_logs").insert({
        action: "DELETE_VISIT",
        details: { visit_id: visitId, deleted_by: (await supabase.auth.getUser()).data.user?.id },
        user_id: (await supabase.auth.getUser()).data.user?.id
      });
      if (logError) console.error("Error logging action:", logError);

      toast({
        title: "Visit deleted",
        description: "The visit record has been permanently removed.",
      });
      loadVisits();
    } catch (error: any) {
      toast({
        title: "Error deleting visit",
        description: error.message,
        variant: "destructive",
      });
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
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
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
                  <TableHead>Receptionist</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Benefit Deducted</TableHead>
                  <TableHead>Branch Comp.</TableHead>
                  <TableHead>Profit/Loss</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
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

                    return (
                      <TableRow key={visit.id}>
                        <TableCell>
                          {format(new Date(visit.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{visit.members?.full_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {visit.members?.member_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{visit.branches?.name || "N/A"}</TableCell>
                        <TableCell>{visit.doctor?.full_name || "N/A"}</TableCell>
                        <TableCell>{visit.receptionist?.full_name || "N/A"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{servicesList}</TableCell>
                        <TableCell className="max-w-[150px]">
                          <div className="space-y-2">
                            <div className="truncate text-sm" title={visit.diagnosis || ''}>
                              {visit.diagnosis || '-'}
                            </div>
                            {visit.xray_urls && visit.xray_urls.length > 0 && (
                              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                {visit.xray_urls.map((url, idx) => (
                                  <Dialog key={idx}>
                                    <DialogTrigger asChild>
                                      <div className="relative cursor-pointer group rounded border overflow-hidden h-8 w-8 flex-shrink-0 bg-slate-100">
                                        <img src={url} alt="X-ray thumbnail" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white">
                                          <ImageIcon className="h-3 w-3" />
                                        </div>
                                      </div>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl p-1 bg-black/90 border-0">
                                      <DialogHeader className="hidden"><DialogTitle>X-Ray View</DialogTitle></DialogHeader>
                                      <div className="flex items-center justify-center min-h-[50vh]">
                                        <img src={url} alt="X-ray clinical view" className="max-h-[85vh] w-auto object-contain" />
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(visit.status || "unknown")}</TableCell>
                        <TableCell className="text-destructive">
                          -KES {benefitDeducted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-success">
                          +KES {branchCompensation.toLocaleString()}
                        </TableCell>
                        <TableCell className={profitLoss >= 0 ? "text-success" : "text-destructive"}>
                          KES {profitLoss.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() => {
                                setSelectedVisit(visit);
                                setDetailsOpen(true);
                              }}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(visit.id)}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        {/* ... (existing content) */}
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the visit record and associated billing information.
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

      {/* Visit Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">Visit Details</DialogTitle>
          </DialogHeader>

          {selectedVisit && (
            <div className="space-y-8 py-4">
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

                    {selectedVisit.periodontal_status && (
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <Label className="text-[10px] uppercase font-bold text-primary">Periodontal Status</Label>
                        <p className="font-bold text-primary">{selectedVisit.periodontal_status.toUpperCase()}</p>
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
                <Table className="border rounded-xl">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedVisit.bills?.[0]?.bill_items?.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.service_name}</TableCell>
                        <TableCell>
                          {item.total_stages ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                              Stage {item.current_stage} of {item.total_stages}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Service Item</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono italic text-xs text-muted-foreground">Included in Total</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end pt-4">
                  <div className="w-full sm:w-80 space-y-3 bg-slate-50 p-6 rounded-xl border shadow-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Admin Profit/Loss:</span>
                      <span className={cn("font-bold", (selectedVisit.bills?.[0]?.total_profit_loss || 0) >= 0 ? "text-success" : "text-destructive")}>
                        KES {(selectedVisit.bills?.[0]?.total_profit_loss || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Benefit Deducted:</span>
                      <span className="text-destructive">KES {(selectedVisit.bills?.[0]?.total_benefit_cost || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}