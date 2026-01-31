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
import { DollarSign, Loader2, AlertCircle, History } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import { format, getMonth, getYear, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BranchRevenueEntry {
  id: string;
  date: string;
  visit_count: number;
  total_compensation: number;
  total_benefit_deductions: number;
}

interface BranchPayment {
  id: string;
  branch_id: string;
  payment_date: string;
  amount_paid: number;
  period_month: number;
  period_year: number;
  notes: string | null;
  created_at: string;
}

interface StaffInfo {
  branch_id: string | null;
  branches: { name: string } | null;
}

export default function BranchRevenue() {
  const [revenueData, setRevenueData] = useState<BranchRevenueEntry[]>([]);
  const [branchPayments, setBranchPayments] = useState<BranchPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1); // 1-indexed
  const [currentYear, setCurrentYear] = useState(getYear(new Date()));
  const { toast } = useToast();

  useEffect(() => {
    loadStaffAndRevenue(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  const loadStaffAndRevenue = async (month: number, year: number) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffData } = await supabase
      .from("staff")
      .select("branch_id, branches(name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffData?.branch_id) {
      setStaffInfo(staffData);
      const [revenueRes, paymentsRes] = await Promise.all([
        supabase
          .from("branch_revenue")
          .select("id, date, visit_count, total_compensation, total_benefit_deductions")
          .eq("branch_id", staffData.branch_id)
          .gte("date", format(new Date(year, month - 1, 1), "yyyy-MM-dd"))
          .lt("date", format(new Date(year, month, 1), "yyyy-MM-dd"))
          .order("date", { ascending: false }),
        supabase
          .from("branch_payments")
          .select("*")
          .eq("branch_id", staffData.branch_id)
          .eq("period_month", month)
          .eq("period_year", year)
          .order("payment_date", { ascending: false }),
      ]);

      if (revenueRes.error) {
        toast({
          title: "Error loading revenue data",
          description: revenueRes.error.message,
          variant: "destructive",
        });
      } else {
        setRevenueData(revenueRes.data || []);
      }

      if (paymentsRes.error) {
        toast({
          title: "Error loading payments data",
          description: paymentsRes.error.message,
          variant: "destructive",
        });
      } else {
        setBranchPayments(paymentsRes.data || []);
      }
    } else {
      setStaffInfo(staffData);
      toast({
        title: "Branch not assigned",
        description: "Your staff profile is not assigned to a branch.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const getTotalRevenueForMonth = () => {
    return revenueData.reduce((sum, entry) => sum + entry.total_compensation, 0);
  };

  const getTotalPaidForMonth = () => {
    return branchPayments.reduce((sum, payment) => sum + payment.amount_paid, 0);
  };

  const getOutstandingPayable = () => {
    return getTotalRevenueForMonth() - getTotalPaidForMonth();
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
      <StaffLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StaffLayout>
    );
  }

  if (!staffInfo?.branch_id) {
    return (
      <StaffLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                <AlertCircle className="h-6 w-6" /> Branch Not Assigned
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your staff profile is not assigned to a branch. Please contact your administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </StaffLayout>
    );
  }

  const outstanding = getOutstandingPayable();
  const isPaid = outstanding <= 0;

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Branch Revenue</h1>
            <p className="text-muted-foreground">Financial overview for {staffInfo?.branches?.name || "your assigned branch"}</p>
          </div>
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

        {/* Summary Card */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Payable</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPaid ? "text-success" : "text-destructive"}`}>
              KES {outstanding.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total revenue for {format(new Date(currentYear, currentMonth - 1), "MMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card className="card-elevated overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Daily Revenue Trends ({format(new Date(currentYear, currentMonth - 1), "MMM yyyy")})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>Compensation</TableHead>
                    <TableHead>Benefit Deductions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No daily revenue data available for this month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    revenueData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.visit_count}</TableCell>
                        <TableCell className="text-success">
                          KES {entry.total_compensation.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          KES {entry.total_benefit_deductions.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payments Received ({format(new Date(currentYear, currentMonth - 1), "MMM yyyy")})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Paid</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No payments received for this month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branchPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-success">KES {payment.amount_paid.toLocaleString()}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{payment.notes || "N/A"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  );
}