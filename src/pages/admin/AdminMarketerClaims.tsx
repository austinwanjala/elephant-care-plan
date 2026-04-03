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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Loader2, DollarSign, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface ClaimData {
    id: string;
    amount: number;
    referral_count: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    notes: string | null;
    entity_name: string;
    entity_code: string;
    type: "marketer" | "super_agent";
}

export default function AdminMarketerClaims() {
    const [claimRoleFilter, setClaimRoleFilter] = useState<"marketer" | "super_agent">("marketer");
    const [claims, setClaims] = useState<ClaimData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState<ClaimData | null>(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
    const [actionNotes, setActionNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();
    const [userRole, setUserRole] = useState<string>("");

    useEffect(() => {
        checkUserRole();
    }, []);

    useEffect(() => {
        loadClaims();
    }, [claimRoleFilter]);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
            setUserRole((data?.role as string) || "");
        }
    };

    const loadClaims = async () => {
        setLoading(true);
        try {
            if (claimRoleFilter === "marketer") {
                const { data, error } = await (supabase as any)
                    .from("marketer_claims")
                    .select("*, marketers(full_name, code, email)")
                    .order("created_at", { ascending: false });
                if (error) throw error;
                const formatted: ClaimData[] = (data || []).map((c: any) => ({
                    id: c.id,
                    amount: c.amount,
                    referral_count: c.referral_count,
                    status: c.status,
                    created_at: c.created_at,
                    paid_at: c.paid_at,
                    notes: c.notes,
                    entity_name: c.marketers?.full_name || "Unknown Marketer",
                    entity_code: c.marketers?.code || "N/A",
                    type: "marketer"
                }));
                setClaims(formatted);
            } else {
                const { data, error } = await supabase.rpc("get_super_agent_claims" as any);
                if (error) throw error;
                const formatted: ClaimData[] = (data || []).map((c: any) => ({
                    id: c.id,
                    amount: c.amount,
                    referral_count: c.referral_count,
                    status: c.status,
                    created_at: c.created_at,
                    paid_at: c.paid_at,
                    notes: c.notes,
                    entity_name: c.super_agent_email || "Super Agent",
                    entity_code: "SA-Global",
                    type: "super_agent"
                }));
                setClaims(formatted);
            }
        } catch (error: any) {
            toast({ title: "Error loading claims", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveClick = (claim: ClaimData) => {
        setSelectedClaim(claim);
        setActionNotes("");
        setApprovalDialogOpen(true);
    };

    const handlePayClick = (claim: ClaimData) => {
        setSelectedClaim(claim);
        setActionNotes("");
        setPaymentDialogOpen(true);
    };

    const handleRejectClick = (claim: ClaimData) => {
        setSelectedClaim(claim);
        setActionNotes("");
        setRejectionDialogOpen(true);
    };

    const getTableName = (type: "marketer" | "super_agent") => {
        return type === "marketer" ? "marketer_claims" : "super_agent_claims";
    };

    const handleProcessApproval = async () => {
        if (!selectedClaim) return;
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            const { error: rpcError } = await (supabase as any).rpc('process_claim', {
                p_claim_id: selectedClaim.id,
                p_action: 'approve',
                p_type: selectedClaim.type,
                p_notes: actionNotes ? `Approval Note: ${actionNotes}` : null,
                p_admin_id: user?.id
            });

            if (rpcError) throw rpcError;

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
            
            const { error: rpcError } = await (supabase as any).rpc('process_claim', {
                p_claim_id: selectedClaim.id,
                p_action: 'pay',
                p_type: selectedClaim.type,
                p_notes: actionNotes ? `Payment Note: ${actionNotes}` : null,
                p_admin_id: user?.id
            });

            if (rpcError) throw rpcError;

            toast({ title: "Payment Recorded", description: `KES ${selectedClaim.amount.toLocaleString()} paid.` });
            setPaymentDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleProcessRejection = async () => {
        if (!selectedClaim) return;
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            const { error: rpcError } = await (supabase as any).rpc('process_claim', {
                p_claim_id: selectedClaim.id,
                p_action: 'reject',
                p_type: selectedClaim.type,
                p_notes: actionNotes ? `Rejection Reason: ${actionNotes}` : "Rejected by Admin",
                p_admin_id: user?.id
            });

            if (rpcError) throw rpcError;

            toast({ title: "Claim Rejected", description: "Claim has been rejected." });
            setRejectionDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({ title: "Rejection Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && claims.length === 0) {
        return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>;
    }

    const pendingClaims = claims.filter(c => c.status === 'pending');
    const financeClaims = claims.filter(c => c.status === 'finance_review');
    const historyClaims = claims.filter(c => c.status === 'paid' || c.status === 'rejected');

    const canApprove = userRole === 'admin' || userRole === 'super_admin';
    const canPay = userRole === 'finance' || userRole === 'super_admin';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Claims Management</h1>
                    <p className="text-muted-foreground">Approve commissions and process payouts.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-md">
                    <button
                        onClick={() => setClaimRoleFilter("marketer")}
                        className={`px-4 py-2 text-sm font-medium rounded-sm transition-all ${claimRoleFilter === 'marketer' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Marketers
                    </button>
                    <button
                        onClick={() => setClaimRoleFilter("super_agent")}
                        className={`px-4 py-2 text-sm font-medium rounded-sm transition-all ${claimRoleFilter === 'super_agent' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Super Agents
                    </button>
                </div>
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
                            <CardDescription>Claims requesting payout approval</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ClaimsTable
                                claims={pendingClaims}
                                actionLabel="Approve"
                                onAction={handleApproveClick}
                                actionDisabled={!canApprove}
                                actionVariant="outline"
                                onReject={handleRejectClick}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="finance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ready for Payment</CardTitle>
                            <CardDescription>Claims approved by Admin, awaiting Finance execution</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ClaimsTable
                                claims={financeClaims}
                                actionLabel="Process Payment"
                                onAction={handlePayClick}
                                actionDisabled={!canPay} 
                                actionVariant="default"
                                onReject={canPay ? handleRejectClick : undefined} 
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Claim History</CardTitle>
                            <CardDescription>Previously processed payouts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ClaimsTable claims={historyClaims} />
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
                            Confirm this claim for {selectedClaim?.entity_name}. It will be sent to Finance.
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

            {/* Rejection Dialog */}
            <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Reject Claim</DialogTitle>
                        <DialogDescription>
                            Reject claim for {selectedClaim?.entity_name}. This action cannot be undone easily.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center sm:text-lg font-semibold">
                            <span>Amount:</span>
                            <span>KES {selectedClaim?.amount.toLocaleString()}</span>
                        </div>
                        <Textarea
                            placeholder="Reason for rejection (required)..."
                            value={actionNotes}
                            onChange={e => setActionNotes(e.target.value)}
                            className="border-destructive/50 focus-visible:ring-destructive"
                        />
                        <Button onClick={handleProcessRejection} disabled={submitting || !actionNotes.trim()} className="w-full" variant="destructive">
                            {submitting ? <Loader2 className="animate-spin mr-2" /> : null}
                            Confirm Rejection
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
                            Record payment details for {selectedClaim?.entity_name}.
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

function ClaimsTable({ claims, actionLabel, onAction, actionDisabled, actionVariant = "default", onReject }: {
    claims: ClaimData[],
    actionLabel?: string,
    onAction?: (c: ClaimData) => void,
    actionDisabled?: boolean,
    actionVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link",
    onReject?: (c: ClaimData) => void
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
                        <TableHead>Recipient</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        {(actionLabel || onReject) && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {claims.map((claim) => (
                        <TableRow key={claim.id}>
                            <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                                <div className="font-medium">{claim.entity_name}</div>
                                <div className="text-xs text-muted-foreground">{claim.entity_code}</div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={claim.type === 'super_agent' ? 'border-purple-200 text-purple-700 bg-purple-50' : ''}>
                                    {claim.type === 'super_agent' ? 'Super Agent' : 'Field Marketer'}
                                </Badge>
                            </TableCell>
                            <TableCell>{claim.referral_count}</TableCell>
                            <TableCell className="font-bold">KES {claim.amount.toLocaleString()}</TableCell>
                            <TableCell>
                                <ClaimBadge status={claim.status} />
                            </TableCell>
                            {(actionLabel || onReject) && (
                                <TableCell className="text-right space-x-2">
                                    {onReject && (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => onReject(claim)}
                                            disabled={actionDisabled}
                                        >
                                            Reject
                                        </Button>
                                    )}
                                    {actionLabel && (
                                        <Button
                                            size="sm"
                                            variant={actionVariant}
                                            onClick={() => onAction && onAction(claim)}
                                            disabled={actionDisabled}
                                        >
                                            {actionLabel}
                                        </Button>
                                    )}
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
        case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
        default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
}
