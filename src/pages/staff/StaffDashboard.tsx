import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  User,
  Shield,
  FileText,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffInfo {
  id: string;
  full_name: string;
  branch_id: string | null;
  branches: { name: string } | null;
}

interface Visit {
  id: string;
  benefit_deducted: number;
  branch_compensation: number;
  created_at: string;
  services: { name: string } | null;
  members: { full_name: string; member_number: string } | null;
}

interface BranchStats {
  todayVisits: number;
  todayRevenue: number;
  todayDeductions: number;
}

const StaffDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStats>({
    todayVisits: 0,
    todayRevenue: 0,
    todayDeductions: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadStaffDataAndRelatedInfo();
  }, []);

  const loadStaffDataAndRelatedInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*, branches(name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffError) {
      toast({
        title: "Error loading staff profile",
        description: staffError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (staffData) {
      setStaffInfo(staffData);
      if (staffData.branch_id) {
        await Promise.all([
          loadRecentVisits(staffData.branch_id),
          loadBranchStats(staffData.branch_id),
        ]);
      } else {
        setRecentVisits([]);
        setBranchStats({ todayVisits: 0, todayRevenue: 0, todayDeductions: 0 });
      }
    } else {
      toast({
        title: "Staff profile not found",
        description: "Please contact support. Redirecting to dashboard.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }

    setLoading(false);
  };

  const loadRecentVisits = async (branchId: string | null) => {
    if (!branchId) return;

    const { data } = await supabase
      .from("visits")
      .select("*, services(name), members(full_name, member_number)")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setRecentVisits(data);
  };

  const loadBranchStats = async (branchId: string | null) => {
    if (!branchId) return;

    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("branch_revenue")
      .select("visit_count, total_compensation, total_benefit_deductions")
      .eq("branch_id", branchId)
      .eq("date", today)
      .maybeSingle();

    if (data) {
      setBranchStats({
        todayVisits: data.visit_count,
        todayRevenue: data.total_compensation,
        todayDeductions: data.total_benefit_deductions,
      });
    } else {
      setBranchStats({
        todayVisits: 0,
        todayRevenue: 0,
        todayDeductions: 0,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staffInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Staff Profile Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't load your staff profile. This might mean your user account is not linked to a staff entry, or there was a database issue.
            </p>
            <Button onClick={() => navigate("/login")} className="btn-primary">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!staffInfo.branch_id) {
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
              Your staff profile is not assigned to a branch. Please contact your administrator to assign a branch.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Branch Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchStats.todayVisits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branch Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              KES {branchStats.todayRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benefit Deductions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {branchStats.todayDeductions.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Visits */}
      <div className="card-elevated overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Recent Services
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Benefit Deducted</TableHead>
                <TableHead>Branch Comp.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No services processed yet today
                  </TableCell>
                </TableRow>
              ) : (
                recentVisits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>
                      {new Date(visit.created_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{visit.members?.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {visit.members?.member_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{visit.services?.name}</TableCell>
                    <TableCell className="text-destructive">
                      -KES {visit.benefit_deducted.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-success">
                      +KES {visit.branch_compensation.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;