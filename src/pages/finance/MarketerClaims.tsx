import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function FinanceMarketerClaims() {
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState<any>(null);
    const [payDialogOpen, setPayDialogOpen] = useState(false);
    const [paymentNotes, setPaymentNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadClaims();
    }, []);

    const loadClaims = async () => {
        setLoading(true);
        const { data } = await (supabase as any)
            .from("marketer_claims")
            .select("*, marketers(full_name, code)")
            .eq("status", "approved")
            .order("created_at", { ascending: false });
        setClaims(data || []);
        setLoading(false);
    };

    const handleProcessPayment = async () => {
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await (supabase as any)
                .from("marketer_claims")
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    paid_by: user?.id,
                    notes: paymentNotes
                })
                .eq("id", selectedClaim.id);

            if (error) throw error;
            toast({ title: "Payment Recorded", description: "Marketer claim has been marked as paid." });
            setPayDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Marketer Payouts</h1>
            <Card>
                <CardHeader><CardTitle>Approved Claims</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Marketer</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {claims.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No approved claims to pay.</TableCell></TableRow>
                            ) : (
                                claims.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <div className="font-bold">{c.marketers?.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{c.marketers?.code}</div>
                                        </TableCell>
                                        <TableCell className="font-bold text-blue-700">KES {c.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Button size="sm" onClick={() => { setSelectedClaim(c); setPayDialogOpen(true); }}>
                                                Record Payment
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Record Payout</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="text-lg font-bold">Paying: KES {selectedClaim?.amount.toLocaleString()}</div>
                        <div className="space-y-2">
                            <Label>Payment Reference / Notes</Label>
                            <Textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. M-Pesa Ref: QWERTY" />
                        </div>
                        <Button onClick={handleProcessPayment} className="w-full" disabled={submitting}>
                            {submitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                            Confirm Disbursement
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}