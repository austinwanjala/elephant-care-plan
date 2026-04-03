import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Info, CheckCircle2, DollarSign, UploadCloud, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const BranchFinesBanner = () => {
    const [fines, setFines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [branchId, setBranchId] = useState<string | null>(null);
    const [selectedFine, setSelectedFine] = useState<any>(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    // form state
    const [mpesaRef, setMpesaRef] = useState("");
    const [reasonOut, setReasonOut] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        fetchFines();
        
        // Listen for realtime updates on this table so directors see approvals instantly!
        const channel = supabase.channel('schema-db-changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'branch_fines' },
                () => { fetchFines(); }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchFines = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }
        
        const { data: staffData } = await supabase.from("staff").select("branch_id").eq("user_id", user.id).limit(1).maybeSingle();
        const bId = staffData?.branch_id;
        
        if (bId) {
            setBranchId(bId);
            const { data: finesData } = await supabase
                .from("branch_fines")
                .select("*")
                .eq("branch_id", bId)
                .in("status", ["unpaid", "waiting_approval"]);
            setFines(finesData || []);
        }
        setLoading(false);
    };

    const handleSubmitPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!mpesaRef || !selectedFine) {
            toast({ title: "Error", description: "MPESA code is required.", variant: "destructive" });
            return;
        }

        setSubmitLoading(true);
        try {
            const { error } = await supabase.from("branch_fines").update({
                payment_amount_submitted: parseFloat(selectedFine.amount),
                mpesa_reference: mpesaRef.toUpperCase(),
                payment_reason: reasonOut,
                status: "waiting_approval",
                payment_submitted_at: new Date().toISOString()
            }).eq("id", selectedFine.id);

            if(error) throw error;
            
            toast({ title: "Payment Submitted", description: "Your payment details have been sent to Finance for approval." });
            setMpesaRef("");
            setReasonOut("");
            setSelectedFine(null);
            fetchFines();
        } catch(err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loading || fines.length === 0) return null;

    return (
        <div className="mb-6 space-y-4 max-w-7xl mx-auto w-full">
            {fines.map(fine => {
                const isPending = fine.status === "waiting_approval";
                
                return (
                    <div key={fine.id} className={`w-full p-6 rounded-3xl border-2 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-xl ${isPending ? 'bg-blue-50/90 border-blue-200' : 'bg-red-50/90 border-red-200'} backdrop-blur`}>
                        <div className="flex gap-5 items-start">
                           <div className={`p-4 rounded-2xl ${isPending ? 'bg-blue-100/50 text-blue-600' : 'bg-red-100/50 text-red-600'} flex-shrink-0 border ${isPending ? 'border-blue-200' : 'border-red-200'}`}>
                               {isPending ? <Info className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
                           </div>
                           <div className="space-y-2 pt-1">
                               <h3 className={`text-xl font-black ${isPending ? 'text-blue-900' : 'text-red-900'}`}>
                                   {isPending ? 'Fine Payment Under Review' : `Level ${fine.warning_level} Critical Auditor Sanction`}
                               </h3>
                               <p className={`${isPending ? 'text-blue-800' : 'text-red-800'} font-medium`}>
                                   The Auditor has flagged this branch for non-compliance. Amount Due: <span className="font-black text-lg">KES {fine.amount?.toLocaleString()}</span>
                               </p>
                               <div className={`${isPending ? 'bg-blue-100/50 text-blue-900' : 'bg-red-100/50 text-red-900'} text-sm p-3 rounded-xl border ${isPending ? 'border-blue-200/50' : 'border-red-200/50'}`}>
                                   <span className="font-black uppercase tracking-widest text-[10px] opacity-70 block mb-1">Auditor Note / Reason</span>
                                   {fine.reason}
                               </div>
                               {isPending && (
                                   <div className="text-blue-700 text-sm font-bold bg-blue-100/50 p-2 px-4 rounded-xl inline-flex items-center border border-blue-200/50 mt-2 uppercase tracking-widest">
                                       <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                                       STATUS: WAITING APPROVAL - Finance is verifying MPESA Transaction {fine.mpesa_reference}
                                   </div>
                               )}
                           </div>
                        </div>
                        
                        {!isPending && (
                            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-black whitespace-nowrap shadow-xl shadow-red-600/30 w-full md:w-auto h-14 px-8 rounded-2xl" onClick={() => setSelectedFine(fine)}>
                                <DollarSign className="mr-2 h-6 w-6" /> Submit Fine Payment
                            </Button>
                        )}
                    </div>
                );
            })}

            <Dialog open={!!selectedFine} onOpenChange={(val) => !val && setSelectedFine(null)}>
                <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl bg-white p-0 overflow-hidden">
                    <div className="bg-red-50 p-8 border-b border-red-100">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-red-900 font-serif">Clear Sanction Details</DialogTitle>
                        </DialogHeader>
                        <p className="text-red-700 font-medium text-sm mt-2">Provide your payment details to forward to the finance authorization desk.</p>
                    </div>
                    <form onSubmit={handleSubmitPayment} className="space-y-6 pt-4 p-8">
                        <div className="bg-slate-50 p-6 border border-slate-100 rounded-2xl flex justify-between items-center shadow-inner">
                            <div className="text-sm text-slate-500 font-black uppercase tracking-widest">Total Outstanding</div>
                            <div className="text-3xl font-black text-slate-900">KES {selectedFine?.amount?.toLocaleString()}</div>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="font-black text-slate-700">M-Pesa Reference <span className="text-red-500">*</span></Label>
                                <Input required className="h-12 bg-slate-50/50 border-slate-200 font-black text-emerald-700 uppercase" value={mpesaRef} onChange={e => setMpesaRef(e.target.value)} placeholder="e.g. QKZ9A1..." />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-black text-slate-700">Payment Note / Description <span className="text-red-500">*</span></Label>
                                <Input required className="h-12 bg-slate-50/50 border-slate-200 font-medium" value={reasonOut} onChange={e => setReasonOut(e.target.value)} placeholder="Enter details about this payment (who submitted it etc.)" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                            <Button type="button" variant="ghost" className="h-12 font-bold px-6 text-slate-500 hover:text-slate-900" onClick={() => setSelectedFine(null)}>Cancel</Button>
                            <Button type="submit" disabled={submitLoading} className="h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-black px-8 shadow-xl shadow-slate-900/20">
                                {submitLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
                                Submit to Finance
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
