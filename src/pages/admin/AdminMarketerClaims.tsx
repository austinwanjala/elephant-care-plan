import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, DollarSign, Clock, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface MarketerClaim {
    id: string;
    amount: number;
    referral_count: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    notes: string | null;
    approved_at: string | null;
    approved_by: string | null;
    marketers: {
        full_name: string;
        code: string;
        email: string;
    } | null;
}

export default function AdminMarketerClaims() {
    const [claims, setClaims] = useState<MarketerClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState<MarketerClaim | null>(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [actionNotes, setActionNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();
    const [userRole, setUserRole] = useState<string>("");

    useEffect(() => {
        loadClaims();
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
            setUserRole((data?.role as string) || "");
        }
    };

    const loadClaims = async () => {
        setLoading(true);
        const { data, error } = await (supabase as any)
            .from("marketer_claims")
            .select("*, marketers(full_name, code, email)")
            .order("created_at", { ascending: false });

        if (error) {
            toast({ title: "Error loading claims", description: error.message, variant: "destructive" });
        } else {
            setClaims(data || []);
        }
        setLoading(false);
    };

    const handleApproveClick = (claim: MarketerClaim) => {
        setSelectedClaim(claim);
        setActionNotes("");
        setApprovalDialogOpen(true);
    };

    const handlePayClick = (claim: MarketerClaim) => {
        setSelectedClaim(claim);
        setActionNotes("");
        setPaymentDialogOpen(true);
    };

    const handleProcessApproval = async () => {
        if (!selectedClaim) return;
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: adminStaff } = await supabase.from("staff").select("id").eq("user_id", user!.id).single();

            const { error } = await (supabase as any)
                .from("marketer_claims")
                .update({
                    status: 'finance_review',
                    approved_at: new Date().toISOString(),
                    approved_by: adminStaff?.id,
                    notes: actionNotes ? `Approval Note: ${actionNotes}` : null
                })
                .eq("id", selectedClaim.id);

            if (error) throw error;

            toast({ title: "Claim Approved", description: "Sent to finance for payment processing." });
            setApprovalDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({ title: "Approval Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleProcessPayment = async () => {
        if (!selectedClaim) return;
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: staffData } = await supabase.from("staff").select("id").eq("user_id", user!.id).single();

            const existingNotes = selectedClaim.notes || "";
            const newNotes = actionNotes ? `${existingNotes}\nPayment Note: ${actionNotes}` : existingNotes;

            const { error } = await (supabase as any)
                .from("marketer_claims")
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    paid_by: staffData?.id,
                    notes: newNotes.trim()
                })
                .eq("id", selectedClaim.id);

            if (error) throw error;

            toast({ title: "Payment Recorded", description: `KES ${selectedClaim.amount.toLocaleString()} paid.` });
            setPaymentDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;
    }

    const pendingClaims = claims.filter(c => c.status === 'pending');
    const financeClaims = claims.filter(c => c.status === 'finance_review');
    const paidClaims = claims.filter(c => c.status === 'paid');

    const canApprove = userRole === 'admin' || userRole === 'super_admin';
    const canPay = userRole === 'finance' || userRole === 'super_admin';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-serif font-bold text-foreground">Marketer Claims Management</h1>
                <p className="text-muted-foreground">Approve commissions and process payments.</p>
            </div>

            <Tabs defaultValue={canPay ? "finance" : "pending"} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="pending">
                        Pending Admin
                        <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">{pendingClaims.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="finance">
                        Finance Review
                        <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">{financeClaims.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Admin Approval</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ClaimsTable
                                claims={pendingClaims}
                                actionLabel="Approve"
                                onAction={handleApproveClick}
                                actionDisabled={!canApprove}
                                actionVariant="outline"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="finance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ready for Payment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ClaimsTable
                                claims={financeClaims}
                                actionLabel="Process Payment"
                                onAction={handlePayClick}
                                actionDisabled={!canPay} // Only finish logic
                                actionVariant="default"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paid Claims</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ClaimsTable claims={paidClaims} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approval Dialog */}
            <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve Claim</DialogTitle>
                        <DialogDescription>
                            Confirm this claim for {selectedClaim?.marketers?.full_name}. It will be sent to finance.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center sm:text-lg font-semibold">
                            <span>Amount:</span>
                            <span>KES {selectedClaim?.amount.toLocaleString()}</span>
                        </div>
                        <Textarea
                            placeholder="Add approval notes (optional)..."
                            value={actionNotes}
                            onChange={e => setActionNotes(e.target.value)}
                        />
                        <Button onClick={handleProcessApproval} disabled={submitting} className="w-full">
                            {submitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            Approve for Finance
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Process Payment</DialogTitle>
                        <DialogDescription>
                            Record payment details for {selectedClaim?.marketers?.full_name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center sm:text-lg font-semibold text-green-700">
                            <span>Payable Amount:</span>
                            <span>KES {selectedClaim?.amount.toLocaleString()}</span>
                        </div>
                        <Textarea
                            placeholder="Payment reference / M-Pesa code..."
                            value={actionNotes}
                            onChange={e => setActionNotes(e.target.value)}
                        />
                        <Button onClick={handleProcessPayment} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700">
                            {submitting ? <Loader2 className="animate-spin mr-2" /> : <DollarSign className="mr-2 h-4 w-4" />}
                            Confirm Payment
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ClaimsTable({ claims, actionLabel, onAction, actionDisabled, actionVariant = "default" }: {
    claims: MarketerClaim[],
    actionLabel?: string,
    onAction?: (c: MarketerClaim) => void,
    actionDisabled?: boolean,
    actionVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link"
}) {
    if (claims.length === 0) {
        return <div className="text-center py-8 text-muted-foreground">No claims found in this category.</div>;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Marketer</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        {actionLabel && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {claims.map((claim) => (
                        <TableRow key={claim.id}>
                            <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                                <div className="font-medium">{claim.marketers?.full_name}</div>
                                <div className="text-xs text-muted-foreground">{claim.marketers?.code}</div>
                            </TableCell>
                            <TableCell>{claim.referral_count}</TableCell>
                            <TableCell className="font-bold">KES {claim.amount.toLocaleString()}</TableCell>
                            <TableCell>
                                <ClaimBadge status={claim.status} />
                            </TableCell>
                            {actionLabel && (
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant={actionVariant}
                                        onClick={() => onAction && onAction(claim)}
                                        disabled={actionDisabled}
                                    >
                                        {actionLabel}
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function ClaimBadge({ status }: { status: string }) {
    switch (status) {
        case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
        case 'finance_review': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Finance Review</Badge>;
        case 'paid': return <Badge className="bg-green-600">Paid</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
}