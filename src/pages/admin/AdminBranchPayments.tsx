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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CheckCircle, Loader2, History } from "lucide-react";
import { format, getMonth, getYear, subMonths, addMonths } from "date-fns";

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface BranchRevenueSummary {
  branch_id: string;
  total_compensation: number;
}

interface BranchPayment {
  id: string;
  branch_id: string;
  payment_date: string;
  amount_paid: number;
  paid_by_user_id: string;
  period_month: number;
  period_year: number;
  notes: string | null;
  created_at: string;
}

export default function AdminBranchPayments() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [revenueSummaries, setRevenueSummaries] = useState<Record<string, number>>({});
  const [payments, setPayments] = useState<BranchPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1); // 1-indexed
  const [currentYear, setCurrentYear] = useState(getYear(new Date()));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  const loadData = async (month: number, year: number) => {
    setLoading(true);
    const [branchesRes, revenueRes, paymentsRes] = await Promise.all([
      supabase.from("branches").select("id, name, location").eq("is_active", true).order("name"),
      supabase
        .from("branch_revenue")
        .select("branch_id, total_compensation")
        .gte("date", format(new Date(year, month - 1, 1), "yyyy-MM-dd"))
        .lt("date", format(new Date(year, month, 1), "yyyy-MM-dd")),
      supabase
        .from("branch_payments")
        .select("*")
        .eq("period_month", month)
        .eq("period_year", year)
        .order("payment_date", { ascending: false }),
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);

    if (revenueRes.data) {
      const summary: Record<string, number> = {};
      branchesRes.data?.forEach(branch => summary[branch.id] = 0); // Initialize all branches to 0
      revenueRes.data.forEach((r) => {
        summary[r.branch_id] = (summary[r.branch_id] || 0) + r.total_compensation;
      });
      setRevenueSummaries(summary);
    }

    if (paymentsRes.data) setPayments(paymentsRes.data);

    setLoading(false);
  };

  const getOutstandingPayable = (branchId: string) => {
    const totalRevenue = revenueSummaries[branchId] || 0;
    const totalPaid = payments
      .filter((p) => p.branch_id === branchId && p.period_month === currentMonth && p.period_year === currentYear)
      .reduce((sum, p) => sum + p.amount_paid, 0);
    return totalRevenue - totalPaid;
  };

  const handleMarkAsPaid = (branch: Branch) => {
    setSelectedBranch(branch);
    const outstanding = getOutstandingPayable(branch.id);
    setPaymentAmount(outstanding > 0 ? outstanding.toFixed(2) : "0.00");
    setPaymentNotes("");
    setPaymentDialogOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedBranch || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { error } = await supabase.from("branch_payments").insert({
        branch_id: selectedBranch.id,
        amount_paid: parseFloat(paymentAmount),
        paid_by_user_id: user.id,
        period_month: currentMonth,
        period_year: currentYear,
        notes: paymentNotes || null,
      });

      if (error) throw error;

      toast({
        title: "Payment Recorded",
        description: `KES ${parseFloat(paymentAmount).toLocaleString()} marked as paid for ${selectedBranch.name} for ${format(new Date(currentYear, currentMonth - 1), "MMM yyyy")}.`,
      });
      setPaymentDialogOpen(false);
      loadData(currentMonth, currentYear); // Reload data to update outstanding amounts
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleMonthChange = (value: string) => {
    const [yearStr, monthStr] = value.split('-');
    setCurrentYear(parseInt(yearStr));
    setCurrentMonth(parseInt(monthStr));
  };

  const getMonthOptions = () => {
    const options = [];
    let date = new Date();
    // Go back 12 months from current month
    for (let i = 0; i < 12; i++) {
      options.push(date);
      date = subMonths(date, 1);
    }
    return options.reverse(); // Show most recent first
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Branch Payments</h1>
            <p className="text-muted-foreground">Manage revenue payable to hospital branches</p>
          </div>
        </div>

        <Card className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Revenue Overview
            </CardTitle>
            <Select
              value={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((date, index) => (
                  <SelectItem key={index} value={`${getYear(date)}-${(getMonth(date) + 1).toString().padStart(2, '0')}`}>
                    {format(date, "MMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Total Revenue ({format(new Date(currentYear, currentMonth - 1), "MMM yyyy")})</TableHead>
                  <TableHead>Outstanding Payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No active branches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch) => {
                    const outstanding = getOutstandingPayable(branch.id);
                    const isPaid = outstanding <= 0;
                    return (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell>KES {(revenueSummaries[branch.id] || 0).toLocaleString()}</TableCell>
                        <TableCell className={isPaid ? "text-success" : "text-destructive"}>
                          KES {outstanding.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {isPaid ? (
                            <Badge className="bg-success">Paid</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!isPaid && (
                            <Button
                              size="sm"
                              className="btn-primary"
                              onClick={() => handleMarkAsPaid(branch)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="card-elevated p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No payments recorded for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => {
                      const branchName = branches.find(b => b.id === payment.branch_id)?.name || "Unknown";
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.payment_date), "MMM d, yyyy")}</TableCell>
                          <TableCell>{branchName}</TableCell>
                          <TableCell>{format(new Date(payment.period_year, payment.period_month - 1), "MMM yyyy")}</TableCell>
                          <TableCell className="text-success">KES {payment.amount_paid.toLocaleString()}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{payment.notes || "N/A"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Record Payment</DialogTitle>
              <DialogDescription>
                Record a payment to {selectedBranch?.name} for {format(new Date(currentYear, currentMonth - 1), "MMM yyyy")}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Amount Paid (KES)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g., 15000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notes (Optional)</Label>
                <Textarea
                  id="paymentNotes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g., Bank transfer, M-Pesa"
                />
              </div>
              <Button onClick={handleProcessPayment} className="btn-primary" disabled={submittingPayment}>
                {submittingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording Payment...
                  </>
                ) : (
                  "Record Payment"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}