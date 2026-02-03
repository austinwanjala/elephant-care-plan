import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Check, Search } from "lucide-react";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";

export default function ReceptionBilling() {
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchBills();
    }, []);

    const fetchBills = async () => {
        setLoading(true);
        // Fetch visits that have a generated bill or status 'billed'. 
        // Assuming 'visits' has 'status' = 'billed' waiting for payment.
        // Also joining members to show names.
        // @ts-ignore
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(full_name, member_number), bills(*)")
            .eq("status", "billed")
            .order("updated_at", { ascending: false });

        if (error) {
            console.error("Error fetching bills:", error);
            toast({
                title: "Error fetching bills",
                description: error.message,
                variant: "destructive",
            });
        } else {
            setBills(data || []);
        }
        setLoading(false);
    };

    const handleProcessPayment = async (visitId: string, billId: string) => {
        setProcessingId(visitId);
        try {
            // Here we would integrate M-Pesa or just mark as paid for manual entry logic
            // For now, simple mark as paid.

            // Update Bill Status
            // @ts-ignore
            const { error: billError } = await supabase
                .from("bills")
                .update({ status: "paid", payment_method: "cash" }) // hardcoded cash/mpesa for now
                .eq("id", billId);

            if (billError) throw billError;

            // Update Visit Status
            // @ts-ignore
            const { error: visitError } = await supabase
                .from("visits")
                .update({ status: "completed" })
                .eq("id", visitId);

            if (visitError) throw visitError;

            toast({
                title: "Payment Processed",
                description: "Bill marked as paid and visit completed.",
            });

            fetchBills(); // Refresh list

        } catch (error: any) {
            toast({
                title: "Process Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setProcessingId(null);
        }
    };

    const filteredBills = bills.filter(visit =>
        visit.members?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.members?.member_number?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
                    <p className="text-muted-foreground">Process pending payments for visits.</p>
                </div>
            </div>

            <div className="flex items-center space-x-2 w-full max-w-sm">
                <Search className="text-muted-foreground h-4 w-4" />
                <Input
                    placeholder="Search member..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Bills</CardTitle>
                    <CardDescription>Visits requiring payment clearance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Member</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Insurance Covered</TableHead>
                                <TableHead>Payable</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredBills.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No pending bills found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredBills.map((visit) => {
                                    const bill = visit.bills?.[0]; // Assuming 1-1 visit-bill
                                    return (
                                        <TableRow key={visit.id}>
                                            <TableCell>{new Date(visit.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{visit.members?.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{visit.members?.member_number}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>KES {(bill?.total_amount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-green-600">-KES {(bill?.insurance_covered || 0).toLocaleString()}</TableCell>
                                            <TableCell className="font-bold">KES {(bill?.payable_amount || 0).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm">
                                                            <CreditCard className="mr-2 h-4 w-4" />
                                                            Receive Payment
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Confirm Payment</DialogTitle>
                                                            <DialogDescription>
                                                                Mark bill as paid for <b>{visit.members?.full_name}</b>.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4 space-y-2">
                                                            <div className="flex justify-between">
                                                                <span>Total Payable:</span>
                                                                <span className="font-bold text-lg">KES {(bill?.payable_amount || 0).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <Label htmlFor="payment-method">Payment Method</Label>
                                                                <Input disabled value="Cash / M-Pesa (Manual Verification)" />
                                                            </div>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button
                                                                className="w-full btn-primary"
                                                                onClick={() => handleProcessPayment(visit.id, bill?.id)}
                                                                disabled={processingId === visit.id}
                                                            >
                                                                {processingId === visit.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                Confirm Payment Received
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
