import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";

interface PendingFine {
  id: string;
  branch_id: string;
  amount: number;
  payment_amount_submitted: number;
  mpesa_reference: string;
  payment_reason: string;
  warning_level: number;
  reason: string;
  created_at: string;
  status: string;
  branches?: { name: string };
  staff?: { full_name: string };
}

export default function AdminBranchFines() {
  const [fines, setFines] = useState<PendingFine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFines();
  }, []);

  const loadFines = async () => {
    setLoading(true);
    try {
        // We look for any fine that isn't completely 'unpaid' standard
        const { data, error } = await supabase
            .from("branch_fines")
            .select("*, branches:branch_id(name), staff:auditor_id(full_name)")
            .neq("status", "unpaid")
            .order("created_at", { ascending: false });
        
        if (error) throw error;
        setFines(data || []);
    } catch(err: any) {
        toast({ title: "Load Error", description: err.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const handleApproveFine = async (fine: PendingFine) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("branch_fines")
        .update({ status: 'paid' })
        .eq("id", fine.id);
      
      if (error) throw error;

      // Automatically unsuspend the branch if it was level 2/3 and they just cleared it.
      if (fine.warning_level >= 2) {
          await supabase.from("branches")
            .update({ status: 'active', is_active: true })
            .eq("id", fine.branch_id);
      }

      toast({ title: "Fine Payment Approved", description: `Recorded KES ${fine.payment_amount_submitted} for ${fine.mpesa_reference}. Branch access restored if suspended.` });
      await loadFines();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-black text-slate-900 flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-rose-600" /> Auditor Branch Fines
        </h1>
        <p className="text-slate-500 mt-2 font-medium">Verify M-PESA payments from Branch Directors and unblock suspended accounts.</p>
      </div>

      <Card className="card-premium">
        <CardHeader className="header-gradient-rose border-b border-rose-100/30">
            <CardTitle className="text-lg font-black font-serif text-slate-900">Fine Payment Ledger</CardTitle>
            <CardDescription className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                All Submitted Fine Payments
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-6 py-4">Branch Details</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Sanction Issued</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Payment Data</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest text-right pr-6">Action / Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fines.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400 font-bold italic">No submitted fine payments to review.</TableCell></TableRow>
                ) : (
                  fines.map((fine) => {
                    const pending = fine.status === "waiting_approval";
                    
                    return (
                        <TableRow key={fine.id} className={pending ? "bg-amber-50/20" : ""}>
                        <TableCell className="pl-6 py-4">
                            <div className="font-black text-slate-800 text-sm">{fine.branches?.name}</div>
                            <Badge variant="outline" className={`mt-1 font-black uppercase text-[9px] px-2 ${fine.warning_level >= 2 ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                                Level {fine.warning_level} Warning
                            </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                            <div className="text-xs text-slate-600 font-medium truncate" title={fine.reason}>{fine.reason}</div>
                            <div className="text-[10px] font-black text-rose-600 mt-1 uppercase">Due: KES {Number(fine.amount).toLocaleString()}</div>
                        </TableCell>
                        <TableCell>
                            {fine.payment_amount_submitted ? (
                                <>
                                    <div className="text-sm font-black text-emerald-600">KES {Number(fine.payment_amount_submitted).toLocaleString()}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-black uppercase text-[10px] px-2 py-0">REF: {fine.mpesa_reference}</Badge>
                                    </div>
                                    {fine.payment_reason && <div className="text-[10px] font-bold text-slate-400 italic mt-1 line-clamp-1">Note: {fine.payment_reason}</div>}
                                </>
                            ) : (
                                <span className="text-[10px] text-slate-400 font-black uppercase italic">No info documented</span>
                            )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                            {pending ? (
                                <Button 
                                    size="sm" 
                                    onClick={() => handleApproveFine(fine)} 
                                    disabled={submitting}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-black shadow-xl rounded-xl h-9"
                                >
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />}
                                    Verify Clearance
                                </Button>
                            ) : (
                                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-none shadow-inner font-black uppercase tracking-widest text-[9px] px-3 py-1">
                                    Resolved
                                </Badge>
                            )}
                        </TableCell>
                        </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
