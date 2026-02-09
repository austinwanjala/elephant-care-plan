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
import { Loader2, CheckCircle2, DollarSign, Clock, CheckCircle } from "lucide-react";
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
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [adminNotes, setAdminNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadClaims();
    }, []);

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

    const handleApproveClaim = (claim: MarketerClaim) => {
        setSelectedClaim(claim);
        setAdminNotes("");
        setApproveDialogOpen(true);
    };

    const handleProcessApproval = async () => {
        if (!selectedClaim) return;

        setSubmitting(true);
        try {
            const { error } = await (supabase as any)
                .from("marketer_claims")
                .update({
                    status: 'approved',
                    notes: adminNotes || null
                })
                .eq("id", selectedClaim.id);

            if (error) throw error;

            toast({
                title: "Claim Approved",
                description: `KES ${selectedClaim.amount.toLocaleString()} approved for Finance payment.`,
            });
            setApproveDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({
                title: "Approval Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const pendingClaims = claims.filter(c => c.status === 'pending');
    const approvedClaims = claims.filter(c => c.status === 'approved');
    const paidClaims = claims.filter(c => c.status === 'paid');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-serif font-bold text-foreground">Marketer Claims</h1>
                <p className="text-muted-foreground">Review and approve commission claims for Finance processing</p>
            </div>

            <Tabs defaultValue="pending" className="space-y-6">
                <TabsList className="bg-muted p-1 rounded-lg">
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pending ({pendingClaims.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Approved ({approvedClaims.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Paid History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <Card className="card-elevated p-6">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-amber-600" />
                            Pending Review
                        </CardTitle>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date Submitted</TableHead>
                                        <TableHead>Marketer</TableHead>
                                        <TableHead>Referrals</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingClaims.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                No pending claims.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pendingClaims.map((claim) => (
                                            <TableRow key={claim.id}>
                                                <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold">{claim.marketers?.full_name}</div>
                                                    <div className="text-xs text-muted-foreground">{claim.marketers?.code}</div>
                                                </TableCell>
                                                <TableCell>{claim.referral_count} members</TableCell>
                                                <TableCell className="text-lg font-bold text-blue-700">
                                                    KES {claim.amount.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button size="sm" onClick={() => handleApproveClaim(claim)} className="bg-blue-600 hover:bg-blue-700">
                                                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="approved">
                    <Card className="card-elevated p-6">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                            Awaiting Finance Payment
                        </CardTitle>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Marketer</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {approvedClaims.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                No approved claims waiting for payment.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        approvedClaims.map((claim) => (
                                            <TableRow key={claim.id}>
                                                <TableCell>
                                                    <div className="font-bold">{claim.marketers?.full_name}</div>
                                                </TableCell>
                                                <TableCell className="font-bold">KES {claim.amount.toLocaleString()}</TableCell>
                                                <TableCell><Badge className="bg-blue-100 text-blue-800">APPROVED</Badge></TableCell>
                                                <TableCell className="text-sm italic">{claim.notes || '-'}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card className="card-elevated p-6">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Paid Claims History
                        </CardTitle>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Paid Date</TableHead>
                                        <TableHead>Marketer</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paidClaims.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                No paid claims found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paidClaims.map((claim) => (
                                            <TableRow key={claim.id}>
                                                <TableCell>{claim.paid_at ? format(new Date(claim.paid_at), "MMM d, yyyy") : '-'}</TableCell>
                                                <TableCell>{claim.marketers?.full_name}</TableCell>
                                                <TableCell className="font-bold text-green-700">KES {claim.amount.toLocaleString()}</TableCell>
                                                <TableCell><Badge className="bg-green-100 text-green-800">PAID</Badge></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Approve Marketer Claim</DialogTitle>
                        <DialogDescription>
                            Confirm that {selectedClaim?.marketers?.full_name} is eligible for this commission.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Amount to Approve</Label>
                            <div className="text-2xl font-bold text-primary">KES {selectedClaim?.amount.toLocaleString()}</div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adminNotes">Review Notes (Optional)</Label>
                            <Textarea
                                id="adminNotes"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="e.g., Verified referrals"
                            />
                        </div>
                        <Button onClick={handleProcessApproval} className="btn-primary" disabled={submitting}>
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Approve for Payment"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}