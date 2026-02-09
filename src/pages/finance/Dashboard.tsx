import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Calendar,
  CheckCircle,
  Activity,
  History,
  Building2,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export default function FinanceDashboard() {
  const [stats, setStats] = useState({
    totalContributions: 0,
    totalBranchPayouts: 0,
    totalMarketerPayouts: 0,
    pendingBranchClaims: 0,
    pendingMarketerClaims: 0,
    netPosition: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadFinanceStats();
  }, []);

  const loadFinanceStats = async () => {
    setLoading(true);
    try {
      const [paymentsRes, branchClaimsRes, marketerClaimsRes] = await Promise.all([
        supabase.from("payments").select("amount, status"),
        supabase.from("revenue_claims").select("amount, status"),
        supabase.from("marketer_claims").select("amount, status")
      ]);

      const totalContributions = paymentsRes.data
        ?.filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalBranchPayouts = branchClaimsRes.data
        ?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      const totalMarketerPayouts = marketerClaimsRes.data
        ?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      const pendingBranchClaims = branchClaimsRes.data?.filter(c => c.status === 'pending').length || 0;
      const pendingMarketerClaims = marketerClaimsRes.data?.filter(c => c.status === 'pending').length || 0;

      setStats({
        totalContributions,
        totalBranchPayouts,
        totalMarketerPayouts,
        pendingBranchClaims,
        pendingMarketerClaims,
        netPosition: totalContributions - (totalBranchPayouts + totalMarketerPayouts)
      });

      // Mock chart data for now based on totals
      setChartData([
        { name: 'Jan', contributions: totalContributions * 0.1, payouts: (totalBranchPayouts + totalMarketerPayouts) * 0.08 },
        { name: 'Feb', contributions: totalContributions * 0.15, payouts: (totalBranchPayouts + totalMarketerPayouts) * 0.12 },
        { name: 'Mar', contributions: totalContributions * 0.25, payouts: (totalBranchPayouts + totalMarketerPayouts) * 0.2 },
        { name: 'Apr', contributions: totalContributions * 0.5, payouts: (totalBranchPayouts + totalMarketerPayouts) * 0.6 },
      ]);

    } catch (error) {
      console.error("Error loading finance stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-amber-900">Finance Overview</h1>
          <p className="text-muted-foreground mt-1">Treasury and payout management dashboard.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1.5 text-sm bg-amber-50 border-amber-200 text-amber-700">
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">KES {stats.totalContributions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total M-Pesa collections</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">KES {(stats.totalBranchPayouts + stats.totalMarketerPayouts).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Branches & Marketers combined</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Position</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">KES {stats.netPosition.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Available liquidity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
            <CardDescription>Monthly contributions vs payouts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="contributions" stroke="#10b981" strokeWidth={2} name="Collections" />
                  <Line type="monotone" dataKey="payouts" stroke="#ef4444" strokeWidth={2} name="Payouts" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm border-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-600" />
                Branch Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700">{stats.pendingBranchClaims}</div>
              <p className="text-sm text-muted-foreground mb-4">Pending approval</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/finance/branch-payments")}>
                Manage Branch Claims
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Marketer Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700">{stats.pendingMarketerClaims}</div>
              <p className="text-sm text-muted-foreground mb-4">Pending approval</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/finance/marketer-payments")}>
                Manage Marketer Claims
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}