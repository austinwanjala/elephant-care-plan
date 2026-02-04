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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CheckCircle, Loader2, History, ClipboardList, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getMonth, getYear, subMonths } from "date-fns";

interface Branch {
  id: string;
  name: string;
  location: string;
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

interface RevenueClaim {
  id: string;
  branch_id: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  director_id: string;
  director_name?: string;
  branch_name?: string;
  paid_at?: string;
}

export default function AdminBranchPayments() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [revenueSummaries, setRevenueSummaries] = useState<Record<string, number>>({});
  const [payments, setPayments] = useState<BranchPayment[]>([]);
  const [claims, setClaims] = useState<RevenueClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<RevenueClaim | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1);
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
    try {
      const [branchesRes, revenueRes, paymentsRes, claimsRes] = await Promise.all([
        supabase.from("branches").select("id, name, location").eq("is_active", true).order("name"),
        (supabase as any)
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
        (supabase as any)
          .from("revenue_claims")
          .select("*, staff:director_id(full_name), branches:branch_id(name)")
          .order("created_at", { ascending: false }),
      ]);

      if (branchesRes.error) throw branchesRes.error;

      if (branchesRes.data) setBranches(branchesRes.data);

      if (revenueRes.data) {
        const summary: Record<string, number> = {};
        branchesRes.data?.forEach(branch => summary[branch.id] = 0);
        revenueRes.data.forEach((r: any) => {
          summary[r.branch_id] = (summary[r.branch_id] || 0) + r.total_compensation;
        });
        setRevenueSummaries(summary);
      }

      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (claimsRes.data) setClaims(claimsRes.data as any);

    } catch (error: any) {
      console.error("Error loading admin data:", error);
      toast({
        title: "Load Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (claim: RevenueClaim) => {
    setSelectedClaim(claim);
    setPaymentAmount(claim.amount.toString());
    setPaymentNotes("");
    setPaymentDialogOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedClaim || !paymentAmount || parseFloat(paymentAmount) <= 0) {
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

      const { data: adminStaff } = await supabase.from("staff").select("id").eq("user_id", user.id).single();

      const { error: claimError } = await (supabase as any)
        .from("revenue_claims")
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: adminStaff?.id,
          notes: paymentNotes || null
        })
        .eq("id", selectedClaim.id);

      if (claimError) throw claimError;

      toast({
        title: "Claim Paid",
        description: `KES ${parseFloat(paymentAmount).toLocaleString()} marked as paid and claim finalized.`,
      });
      setPaymentDialogOpen(false);
      loadData(currentMonth, currentYear);
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
    for (let i = 0; i < 12; i++) {
      options.push(date);
      date = subMonths(date, 1);
    }
    return options.reverse();
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
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Branch Payments</h1>
          <p className="text-muted-foreground">Manage revenue payable to hospital branches</p>
        </div>
      </div>

      <Tabs defaultValue="claims" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="claims" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Pending Claims
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Claim History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claims">
          <Card className="card-elevated p-6">
            <CardTitle className="mb-6 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-600" />
              Active Branch Claims
            </CardTitle>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Director</TableHead>
                    <TableHead>Compensation Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.filter(c => c.status === 'pending').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No pending claims at this time.
                      </TableCell>
                    </TableRow>
                  ) : (
                    claims.filter(c => c.status === 'pending').map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-bold">{(claim as any).branches?.name}</TableCell>
                        <TableCell>{(claim as any).staff?.full_name}</TableCell>
                        <TableCell className="text-lg font-bold text-blue-700">KES {Number(claim.amount).toLocaleString()}</TableCell>
                        <TableCell><Badge className="bg-amber-100 text-amber-800 border-amber-200">PENDING</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleMarkAsPaid(claim)} className="bg-green-600 hover:bg-green-700">
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

        <TabsContent value="overview">
          <Card className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Monthly Performance Overview
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
                    <TableHead>Total Branch Compensation ({format(new Date(currentYear, currentMonth - 1), "MMM yyyy")})</TableHead>
                    <TableHead>Claim Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No active branches found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map((branch) => {
                      const branchClaims = claims.filter(c => c.branch_id === branch.id);
                      const hasPending = branchClaims.some(c => c.status === 'pending');
                      return (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium">{branch.name}</TableCell>
                          <TableCell>KES {(revenueSummaries[branch.id] || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {hasPending ? (
                              <Badge className="bg-amber-100 text-amber-800">Pending Claim</Badge>
                            ) : (
                              <Badge variant="outline">No Active Claims</Badge>
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
        </TabsContent>

        <TabsContent value="history">
          <Card className="card-elevated p-6">
            <CardTitle className="mb-6 flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Processed Payment History
            </CardTitle>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Method/Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.filter(c => c.status === 'paid').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No processed claims found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    claims.filter(c => c.status === 'paid').map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>{claim.paid_at ? format(new Date(claim.paid_at), "MMM d, yyyy") : '-'}</TableCell>
                        <TableCell>{(claim as any).branches?.name}</TableCell>
                        <TableCell className="font-bold text-green-700">KES {Number(claim.amount).toLocaleString()}</TableCell>
                        <TableCell>{claim.notes || 'N/A'}</TableCell>
                        <TableCell><Badge className="bg-green-100 text-green-800 border-green-200">PAID</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Process Claim Payment</DialogTitle>
            <DialogDescription>
              Record payment to {(selectedClaim as any)?.branches?.name} for the submitted revenue claim.
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
  );
}