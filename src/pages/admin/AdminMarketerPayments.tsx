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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, Users, TrendingUp } from "lucide-react";

interface Marketer {
    id: string;
    code: string;
    total_earnings: number;
    is_active: boolean;
    referral_count: number; // Calculated
    total_commission_value: number; // Calculated
    pending_payout: number; // Calculated
    active_referral_count: number; // Calculated
}

export default function AdminMarketerPayments() {
    const [marketers, setMarketers] = useState<Marketer[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedMarketer, setSelectedMarketer] = useState<Marketer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [processing, setProcessing] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch marketers
            const { data: marketersData, error: mError } = await supabase
                .from("marketers")
                .select("id, code, total_earnings, is_active");

            if (mError) throw mError;

            // 2. Fetch all referrals (members) to calculate stats
            // We fetch id, marketer_id, is_active
            const { data: referrals, error: rError } = await supabase
                .from("members")
                .select("id, marketer_id, is_active")
                .not("marketer_id", "is", null);

            if (rError) throw rError;

            // 3. Process data
            const processedMarketers = marketersData.map(m => {
                const myReferrals = referrals.filter(r => r.marketer_id === m.id);
                const activeReferrals = myReferrals.filter(r => r.is_active);

                const totalCommissionValue = activeReferrals.length * 500; // KES 500 per active member
                const pendingPayout = Math.max(0, totalCommissionValue - (m.total_earnings || 0));

                return {
                    ...m,
                    referral_count: myReferrals.length,     // Total referrals
                    active_referral_count: activeReferrals.length, // Active referrals
                    total_commission_value: totalCommissionValue,
                    pending_payout: pendingPayout
                };
            });

            setMarketers(processedMarketers);

        } catch (error: any) {
            console.error("Error loading marketer data:", error);
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const openPaymentDialog = (marketer: Marketer) => {
        setSelectedMarketer(marketer);
        setPaymentAmount(marketer.pending_payout.toString());
        setPaymentDialogOpen(true);
    };

    const handleProcessPayment = async () => {
        if (!selectedMarketer || !paymentAmount) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
            return;
        }

        setProcessing(true);
        try {
            // Update marketer total_earnings
            const newTotal = (selectedMarketer.total_earnings || 0) + amount;

            const { error } = await supabase
                .from("marketers")
                .update({ total_earnings: newTotal })
                .eq("id", selectedMarketer.id);

            if (error) throw error;

            toast({ title: "Payment Recorded", description: `Updated earnings for ${selectedMarketer.code}.` });
            setPaymentDialogOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
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
            <div>
                <h1 className="text-3xl font-bold">Marketer Commissions</h1>
                <p className="text-muted-foreground">Manage payouts for marketer referrals.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Pending Payouts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            KES {marketers.reduce((sum, m) => sum + m.pending_payout, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            KES {marketers.reduce((sum, m) => sum + (m.total_earnings || 0), 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {marketers.reduce((sum, m) => sum + (m.active_referral_count as number), 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Marketer Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Active Referrals</TableHead>
                                <TableHead>Commission Value</TableHead>
                                <TableHead>Paid To Date</TableHead>
                                <TableHead>Pending Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {marketers.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-4">No marketers found.</TableCell></TableRow>
                            ) : (
                                marketers.map(marketer => (
                                    <TableRow key={marketer.id}>
                                        <TableCell className="font-mono font-bold">{marketer.code}</TableCell>
                                        <TableCell>
                                            <Badge variant={marketer.is_active ? 'default' : 'secondary'}>
                                                {marketer.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{marketer.active_referral_count || 0}</TableCell>
                                        <TableCell>KES {marketer.total_commission_value.toLocaleString()}</TableCell>
                                        <TableCell className="text-emerald-600 font-medium">KES {marketer.total_earnings.toLocaleString()}</TableCell>
                                        <TableCell className="text-orange-600 font-bold">KES {marketer.pending_payout.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                className="bg-primary hover:bg-primary/90"
                                                disabled={marketer.pending_payout <= 0}
                                                onClick={() => openPaymentDialog(marketer)}
                                            >
                                                Paying Out
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Process Payment</DialogTitle>
                        <DialogDescription>
                            Record a commission payment for marketer {selectedMarketer?.code}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Payment Amount (KES)</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Available Balance: KES {selectedMarketer?.pending_payout.toLocaleString()}
                        </div>
                        <Button onClick={handleProcessPayment} className="w-full" disabled={processing}>
                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                            Confirm Payment
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
