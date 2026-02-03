import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
import { Loader2, CheckCircle2, XCircle, DollarSign } from "lucide-react";
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
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [paymentNotes, setPaymentNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadClaims();
    }, []);

    const loadClaims = async () => {
        setLoading(true);
        const { data, error } = await supabase
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

    const handlePayClaim = (claim: MarketerClaim) => {
        setSelectedClaim(claim);
        setPaymentNotes("");
        setPaymentDialogOpen(true);
    };

    const handleProcessPayment = async () => {
        if (!selectedClaim) return;

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated.");

            const { data: adminStaff } = await supabase.from("staff").select("id").eq("user_id", user.id).single();

            const { error } = await (supabase as any)
                .from("marketer_claims")
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    paid_by: adminStaff?.id,
                    notes: paymentNotes || null
                })
                .eq("id", selectedClaim.id);

            if (error) throw error;

            toast({
                title: "Claim Paid",
                description: `KES ${selectedClaim.amount.toLocaleString()} marked as paid.`,
            });
            setPaymentDialogOpen(false);
            loadClaims();
        } catch (error: any) {
            toast({
                title: "Payment Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AdminLayout>
        );
    }

    const pendingClaims = claims.filter(c => c.status === 'pending');
    const paidClaims = claims.filter(c => c.status === 'paid');

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Marketer Claims</h1>
                    <p className="text-muted-foreground">Review and approve commission claims from marketers</p>
                </div>

                <Tabs defaultValue="pending" className="space-y-6">
                    <TabsList className="bg-muted p-1 rounded-lg">
                        <TabsTrigger value="pending" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Pending Claims ({pendingClaims.length})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Paid Claims
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                        <Card className="card-elevated p-6">
                            <CardTitle className="mb-6 flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-amber-600" />
                                Pending Marketer Claims
                            </CardTitle>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date Submitted</TableHead>
                                            <TableHead>Marketer</TableHead>
                                            <TableHead>Referrals</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingClaims.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                    No pending claims at this time.
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
                                                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">PENDING</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button size="sm" onClick={() => handlePayClaim(claim)} className="bg-green-600 hover:bg-green-700">
                                                            <CheckCircle2 className="mr-2 h-4 w-4" /> Pay Claim
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
                                            <TableHead>Referrals</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paidClaims.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    No paid claims found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paidClaims.map((claim) => (
                                                <TableRow key={claim.id}>
                                                    <TableCell>
                                                        {claim.paid_at ? format(new Date(claim.paid_at), "MMM d, yyyy") : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-bold">{claim.marketers?.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">{claim.marketers?.code}</div>
                                                    </TableCell>
                                                    <TableCell>{claim.referral_count} members</TableCell>
                                                    <TableCell className="font-bold text-green-700">
                                                        KES {claim.amount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{claim.notes || 'N/A'}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Payment Dialog */}
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="font-serif">Process Marketer Claim Payment</DialogTitle>
                            <DialogDescription>
                                Record payment to {selectedClaim?.marketers?.full_name} for referral commissions.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <div className="text-2xl font-bold text-primary">
                                    KES {selectedClaim?.amount.toLocaleString()}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    For {selectedClaim?.referral_count} active referrals
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
                                <Textarea
                                    id="paymentNotes"
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="e.g., Bank transfer, M-Pesa reference"
                                />
                            </div>
                            <Button onClick={handleProcessPayment} className="btn-primary" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Recording Payment...
                                    </>
                                ) : (
                                    "Confirm Payment"
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
