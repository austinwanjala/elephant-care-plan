import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  CreditCard,
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CheckCircle,
  Activity,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from "date-fns";

interface Stats {
  totalMembers: number;
  activeMembers: number;
  totalContributions: number;
  totalCoverage: number;
  totalVisits: number;
  totalRevenue: number;
  totalProfitLoss: number;
  newMembersInPeriod: number;
}

interface CategoryDistribution {
  name: string;
  count: number;
  color: string;
}

const categoryColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<string>("all"); // "all" or "YYYY-MM"
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    activeMembers: 0,
    totalContributions: 0,
    totalCoverage: 0,
    totalVisits: 0,
    totalRevenue: 0,
    totalProfitLoss: 0,
    newMembersInPeriod: 0,
  });
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, [filterPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    await Promise.all([
      loadStats(),
      loadRecentMembers(),
      loadChartData(),
      loadPendingClaims()
    ]);
    setLoading(false);
  };

  const loadStats = async () => {
    let membersQuery = supabase.from("members").select("coverage_balance, total_contributions, is_active, created_at");
    let revenueQuery = supabase.from("branch_revenue").select("total_compensation, total_profit_loss, date");
    let visitsQuery = supabase.from("visits").select("id, created_at");

    if (filterPeriod !== "all") {
      const [year, month] = filterPeriod.split('-').map(Number);
      const start = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd'T'HH:mm:ss");
      const end = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd'T'HH:mm:ss");
      
      membersQuery = membersQuery.gte("created_at", start).lte("created_at", end);
      revenueQuery = revenueQuery.gte("date", start.split('T')[0]).lte("date", end.split('T')[0]);
      visitsQuery = visitsQuery.gte("created_at", start).lte("created_at", end);
    }

    const [membersRes, revenueRes, categoriesRes, visitsRes] = await Promise.all([
      membersQuery,
      revenueQuery,
      supabase.from("members").select("membership_categories(name)"),
      visitsQuery
    ]);

    if (membersRes.data) {
      const revenueData = revenueRes.data || [];
      setStats({
        totalMembers: membersRes.data.length,
        activeMembers: membersRes.data.filter(m => m.is_active).length,
        totalContributions: membersRes.data.reduce((sum, m) => sum + (m.total_contributions || 0), 0),
        totalCoverage: membersRes.data.reduce((sum, m) => sum + (m.coverage_balance || 0), 0),
        totalVisits: visitsRes.data?.length || 0,
        totalRevenue: revenueData.reduce((sum, r) => sum + (r.total_compensation || 0), 0),
        totalProfitLoss: revenueData.reduce((sum, r) => sum + (r.total_profit_loss || 0), 0),
        newMembersInPeriod: membersRes.data.length,
      });
    }

    if (categoriesRes.data) {
      const distribution: Record<string, number> = {};
      categoriesRes.data.forEach((m: any) => {
        const name = m.membership_categories?.name || "Uncategorized";
        distribution[name] = (distribution[name] || 0) + 1;
      });
      setCategoryDistribution(
        Object.entries(distribution).map(([name, count], index) => ({
          name,
          count,
          color: categoryColors[index % categoryColors.length],
        }))
      );
    }
  };

  const loadRecentMembers = async () => {
    const { data } = await supabase
      .from("members")
      .select("id, full_name, email, created_at, membership_categories(name)")
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentMembers(data || []);
  };

  const loadChartData = async () => {
    const sixMonthsAgo = subMonths(new Date(), 5);
    sixMonthsAgo.setDate(1);

    const { data: revenueData } = await supabase
      .from("branch_revenue")
      .select("date, total_compensation")
      .gte("date", format(sixMonthsAgo, "yyyy-MM-dd"));

    const { data: visitData } = await supabase
      .from("visits")
      .select("created_at")
      .gte("created_at", sixMonthsAgo.toISOString());

    const months: Record<string, { revenue: number; visits: number }> = {};

    for (let i = 0; i < 6; i++) {
      const d = subMonths(new Date(), 5 - i);
      const key = format(d, "MMM yy");
      months[key] = { revenue: 0, visits: 0 };
    }

    revenueData?.forEach((r: any) => {
      const key = format(new Date(r.date), "MMM yy");
      if (months[key]) months[key].revenue += Number(r.total_compensation);
    });

    visitData?.forEach((v: any) => {
      const key = format(new Date(v.created_at), "MMM yy");
      if (months[key]) months[key].visits += 1;
    });

    setChartData(Object.entries(months).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      visits: data.visits
    })));
  };

  const loadPendingClaims = async () => {
    const { data } = await supabase
      .from("revenue_claims")
      .select("id, amount, created_at, branches(name), staff:director_id(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPendingClaims(data || []);
  };

  const getMonthOptions = () => {
    const options = [{ label: "All Time", value: "all" }];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(new Date(), i);
      options.push({
        label: format(d, "MMMM yyyy"),
        value: format(d, "yyyy-MM")
      });
    }
    return options;
  };

  if (loading && !stats.totalMembers) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System-wide performance and member analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-[200px] bg-white">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeMembers} active accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Branch compensation pool</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visits</CardTitle>
            <Activity className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
            <p className="text-xs text-muted-foreground mt-1">Total consultations</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 shadow-sm ${stats.totalProfitLoss >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
            {stats.totalProfitLoss >= 0 ? <ArrowUpRight className="h-4 w-4 text-green-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              KES {Math.abs(stats.totalProfitLoss).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalProfitLoss >= 0 ? 'Surplus' : 'Deficit'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Trend Analytics</CardTitle>
            <CardDescription>Revenue and Visit trends over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `KES ${v/1000}k`} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                  <Line type="monotone" dataKey="visits" stroke="#6366f1" strokeWidth={2} name="Visits" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Pending Claims
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">{pendingClaims.length}</Badge>
            </CardTitle>
            <CardDescription>Branch revenue requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingClaims.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No pending claims</p>
                </div>
              ) : (
                pendingClaims.map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/branch-payments')}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{claim.branches?.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(claim.created_at), "MMM d")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">KES {claim.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" className="w-full text-xs" onClick={() => navigate('/admin/branch-payments')}>Manage All Claims</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Membership Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryDistribution.map((cat) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-muted-foreground">{cat.count} members</span>
                </div>
                <Progress value={stats.totalMembers > 0 ? (cat.count / stats.totalMembers) * 100 : 0} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {m.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(m.created_at), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{m.membership_categories?.name || 'Pending'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}