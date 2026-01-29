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
import { DollarSign, Loader2, AlertCircle } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";

interface BranchRevenueEntry {
  id: string;
  date: string;
  visit_count: number;
  total_compensation: number;
  total_benefit_deductions: number;
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
      .maybeSingle();

    if (staffData?.branch_id) {
      setStaffInfo(staffData);
      const { data, error } = await supabase
        .from("branch_revenue")
        .select("id, date, visit_count, total_compensation, total_benefit_deductions") // Removed total_profit_loss
        .eq("branch_id", staffData.branch_id)
        .order("date", { ascending: false })
        .limit(30);

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
      setStaffInfo(staffData); // Set staffInfo even if branch_id is null to trigger the conditional render
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // NEW: Display message if staff is not assigned to a branch
  if (!staffInfo?.branch_id) {
    return (
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
    );
  }

  return (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}