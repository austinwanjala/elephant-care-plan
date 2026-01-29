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
import { DollarSign, Loader2, TrendingUp } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";

interface BranchRevenueEntry {
  id: string;
  date: string;
  visit_count: number;
  total_compensation: number;
  total_benefit_deductions: number;
  total_profit_loss: number;
}

interface StaffInfo {
  branch_id: string | null;
  branches: { name: string } | null;
}

export default function BranchRevenue() {
  const [revenueData, setRevenueData] = useState<BranchRevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadStaffAndRevenue();
  }, []);

  const loadStaffAndRevenue = async () => {
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
      .maybeSingle(); // Changed from .single() to .maybeSingle()

    if (staffData?.branch_id) {
      setStaffInfo(staffData);
      const { data, error } = await supabase
        .from("branch_revenue")
        .select("*")
        .eq("branch_id", staffData.branch_id)
        .order("date", { ascending: false })
        .limit(30); // Show last 30 days of revenue

      if (error) {
        toast({
          title: "Error loading revenue data",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setRevenueData(data || []);
      }
    } else {
      toast({
        title: "Branch not assigned",
        description: "Your staff profile is not assigned to a branch.",
        variant: "destructive",
      });
    }
    setLoading(false);
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

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Branch Revenue</h1>
          <p className="text-muted-foreground">Financial overview for {staffInfo?.branches?.name || "your assigned branch"}</p>
        </div>

        <Card className="card-elevated overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Recent Revenue Trends
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
                    <TableHead>Profit/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No revenue data available for your branch.
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
                        <TableCell className={entry.total_profit_loss >= 0 ? "text-success" : "text-destructive"}>
                          KES {entry.total_profit_loss.toLocaleString()}
                        </TableCell>
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