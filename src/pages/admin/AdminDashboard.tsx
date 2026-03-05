import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Users,
  CreditCard,
  Shield,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  AlertCircle,
  CheckCircle,
  Activity,
  History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  BarChart,
  Bar,
  Legend
} from "recharts";

interface Stats {
  totalMembers: number;
  activeMembers: number;
  totalContributions: number;
  totalCoverage: number;
  totalVisits: number;
  totalBranches: number;
  totalRevenue: number;
  totalProfitLoss: number;
  totalMarketers: number;
  newMembersThisMonth: number;
}

interface CategoryDistribution {
  name: string;
  count: number;
  color: string;
}

interface ChartData {
  month: string;
  revenue: number;
  visits: number;
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
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    activeMembers: 0,
    totalContributions: 0,
    totalCoverage: 0,
    totalVisits: 0,
    totalBranches: 0,
    totalRevenue: 0,
    totalProfitLoss: 0,
    totalMarketers: 0,
    newMembersThisMonth: 0,
  });
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [showAllTime, setShowAllTime] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
    loadRecentMembers();
    loadChartData();
    loadPendingClaims();
  }, [showAllTime]);

  const loadStats = async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [membersRes, branchesRes, revenueRes, categoriesRes, visitsRes, marketersRes, newMembersRes] = await Promise.all([
      supabase.from("members").select("coverage_balance, total_contributions, is_active"),
      supabase.from("branches").select("id").eq("is_active", true),
      supabase.from("branch_revenue").select("total_compensation, total_profit_loss, date"),
      supabase.from("members").select("membership_category_id, membership_categories(name)"),
      supabase.from("visits").select("id, created_at"),
      supabase.from("marketers").select("id").eq("is_active", true),
      supabase.from("members").select("id").gte("created_at", startOfMonth.toISOString()),
    ]);

    if (membersRes.data && branchesRes.data && visitsRes.data && marketersRes.data) {
      let revenueData = revenueRes.data || [];
      let visitData = visitsRes.data || [];

      if (!showAllTime) {
        const monthStartStr = startOfMonth.toISOString().split('T')[0];
        revenueData = revenueData.filter((r: any) => r.date >= monthStartStr);
        visitData = visitData.filter((v: any) => v.created_at >= startOfMonth.toISOString());
      }

      setStats({
        totalMembers: membersRes.data.length,
        activeMembers: membersRes.data.filter(m => m.is_active).length,
        totalContributions: membersRes.data.reduce((sum, m) => sum + (m.total_contributions || 0), 0),
        totalCoverage: membersRes.data.reduce((sum, m) => sum + (m.coverage_balance || 0), 0),
        totalVisits: visitData.length,
        totalBranches: branchesRes.data.length,
        totalRevenue: revenueData.reduce((sum, r) => sum + (r.total_compensation || 0), 0),
        totalProfitLoss: revenueData.reduce((sum, r) => sum + (r.total_profit_loss || 0), 0),
        totalMarketers: marketersRes.data.length,
        newMembersThisMonth: newMembersRes.data?.length || 0,
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
    // Fetch last 12 months if showAllTime, else 6
    const monthsToFetch = showAllTime ? 12 : 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (monthsToFetch - 1));
    startDate.setDate(1);

    // Fetch Revenue
    const { data: revenueData } = await supabase
      .from("branch_revenue")
      .select("date, total_compensation")
      .gte("date", startDate.toISOString().split('T')[0]);

    // Fetch Visits
    const { data: visitData } = await supabase
      .from("visits")
      .select("created_at")
      .gte("created_at", startDate.toISOString());

    // Aggregate by Month
    const months: Record<string, { revenue: number; visits: number }> = {};

    // Initialize months
    for (let i = 0; i < monthsToFetch; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months[key] = { revenue: 0, visits: 0 };
    }

    revenueData?.forEach((r: any) => {
      const date = new Date(r.date);
      const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (months[key]) months[key].revenue += Number(r.total_compensation);
    });

    visitData?.forEach((v: any) => {
      const date = new Date(v.created_at);
      const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (months[key]) months[key].visits += 1;
    });

    const formattedData = Object.entries(months).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      visits: data.visits
    }));

    setChartData(formattedData);
  };

  const loadPendingClaims = async () => {
    const { data } = await supabase
      .from("revenue_claims")
      .select("id, amount, created_at, branches(name), staff:director_id(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    setPendingClaims(data || []);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `KES ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `KES ${(amount / 1000).toFixed(0)}K`;
    return `KES ${amount.toLocaleString()}`;
  };

  return (
    <div className="dashboard-luxury-bg p-4 md:p-8 min-h-screen">
      <div className="soft-glow-emerald top-[-5%] left-[-5%]" />
      <div className="soft-glow-blue bottom-[-5%] right-[-5%]" />

      <div className="flex flex-col gap-8 relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900 leading-tight">Admin Executive Suite</h1>
            <p className="text-slate-500 mt-1 font-medium italic">High-level strategic overview of your dental network</p>
          </div>
          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-xl shadow-slate-100/50">
            <Button
              variant={showAllTime ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAllTime(!showAllTime)}
              className={cn(
                "rounded-xl font-black text-[10px] uppercase tracking-widest transition-all px-4 h-9",
                showAllTime ? "bg-slate-900 text-white shadow-lg" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <History className="h-3 w-3 mr-2" />
              {showAllTime ? "Show Monthly" : "Show All Time"}
            </Button>
            <div className="flex items-center gap-2 px-4 h-9 rounded-xl bg-slate-900/5 border border-slate-200/50 text-slate-800 font-black text-[10px] uppercase tracking-widest">
              <Calendar className="h-3 w-3 text-primary" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="card-premium-blue group h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 header-gradient-blue border-b border-blue-100/30">
              <CardTitle className="text-[10px] font-black text-blue-800 uppercase tracking-widest leading-none">Total Membership</CardTitle>
              <div className="p-2 rounded-xl transition-all duration-300 icon-glow-blue group-hover:scale-110">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-4xl font-black text-slate-900">{stats.totalMembers.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-emerald-500 border-0 font-bold px-2 py-0 h-4 text-[9px] uppercase tracking-tighter shadow-sm shadow-emerald-200">
                  <ArrowUpRight className="h-2 w-2 mr-0.5" />
                  +{stats.newMembersThisMonth} new arrivals
                </Badge>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <span>Active Rate</span>
                  <span className="text-blue-600">{stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100/50 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ width: `${stats.totalMembers > 0 ? (stats.activeMembers / stats.totalMembers) * 100 : 0}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium-emerald group h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 header-gradient-emerald border-b border-emerald-100/30">
              <CardTitle className="text-[10px] font-black text-emerald-800 uppercase tracking-widest leading-none">System Inflows</CardTitle>
              <div className="p-2 rounded-xl transition-all duration-300 icon-glow-emerald group-hover:scale-110">
                <CreditCard className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-4xl font-black text-slate-900">{formatCurrency(stats.totalContributions)}</div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-2">Aggregated system contributions</p>
            </CardContent>
          </Card>

          <Card className="card-premium-violet group h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 header-gradient-violet border-b border-violet-100/30">
              <CardTitle className="text-[10px] font-black text-violet-800 uppercase tracking-widest leading-none">Network Efficiency</CardTitle>
              <div className="p-2 rounded-xl transition-all duration-300 icon-glow-violet group-hover:scale-110">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-4xl font-black text-slate-900">{stats.totalVisits.toLocaleString()}</div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-2">Processed clinical encounters</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "group h-full",
            stats.totalProfitLoss >= 0 ? "card-premium-emerald" : "card-premium-rose"
          )}>
            <CardHeader className={cn(
              "flex flex-row items-center justify-between space-y-0 pb-2 border-b border-opacity-30",
              stats.totalProfitLoss >= 0 ? "header-gradient-emerald border-emerald-100/30" : "header-gradient-rose border-rose-100/30"
            )}>
              <CardTitle className={cn(
                "text-[10px] font-black uppercase tracking-widest leading-none",
                stats.totalProfitLoss >= 0 ? "text-emerald-800" : "text-rose-800"
              )}>Financial Summary</CardTitle>
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300 group-hover:scale-110",
                stats.totalProfitLoss >= 0 ? "icon-glow-emerald" : "icon-glow-rose"
              )}>
                {stats.totalProfitLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className={cn(
                "text-4xl font-black",
                stats.totalProfitLoss >= 0 ? "text-slate-900" : "text-rose-700"
              )}>{formatCurrency(Math.abs(stats.totalProfitLoss))}</div>
              <div className="flex items-center gap-1 mt-2">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-tighter",
                  stats.totalProfitLoss >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>{stats.totalProfitLoss >= 0 ? 'Surplus recorded' : 'Deficit detected'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <Card className="lg:col-span-2 card-premium group h-full">
            <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/30">
              <div>
                <CardTitle className="text-2xl font-serif font-black text-slate-900">Network Growth Analytics</CardTitle>
                <p className="text-slate-400 text-sm font-medium mt-1">Cross-sectional performance tracking across all nodes</p>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} fontWeight="800" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} fontWeight="800" tickLine={false} axisLine={false} tickFormatter={(value) => `K${value / 1000}k`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} fontWeight="800" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', padding: '20px' }}
                      itemStyle={{ fontStyle: 'normal', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}
                      labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '12px', fontSize: '14px', letterSpacing: '-0.02em' }}
                    />
                    <Legend iconType="circle" />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={5} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 4, fill: '#2563eb' }} dot={false} name="Network Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="visits" stroke="#10b981" strokeWidth={5} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 4, fill: '#10b981' }} dot={false} name="Clinical Visits" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium-dark text-white group h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-[80px] -mr-32 -mt-32 animate-pulse" />
            <CardHeader className="p-8 border-b border-white/5 relative z-10 bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black">Branch Claims</CardTitle>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Pending Settlements</p>
                </div>
                <Badge className="bg-orange-500 text-white border-0 font-black px-3 h-6 shadow-[0_0_15px_rgba(249,115,22,0.4)]">{pendingClaims.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 relative z-10 space-y-4">
              {pendingClaims.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Financials Up to Date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingClaims.map((claim) => (
                    <div key={claim.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group/item shadow-inner">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-black text-white/90 group-hover/item:text-white transition-colors">{claim.branches?.name || 'Unknown Unit'}</p>
                        <p className="text-xs font-black text-emerald-400">KES {claim.amount?.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                        By {claim.staff?.full_name?.split(' ')[0]} • {new Date(claim.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-3 mt-6">
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all shadow-lg"
                  onClick={() => navigate('/admin/branch-payments')}
                >
                  Authorize Settlements <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="ghost" className="h-10 border border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-xl transition-all" onClick={() => navigate('/admin/branches')}>Nodes</Button>
                  <Button variant="ghost" className="h-10 border border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-xl transition-all" onClick={() => navigate('/admin/marketers')}>Partners</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
          <Card className="card-premium h-full">
            <CardHeader className="p-8 header-gradient-blue border-b border-blue-100/30">
              <CardTitle className="text-xl font-serif font-black text-slate-900">Demographic Distribution</CardTitle>
              <p className="text-slate-400 text-sm font-medium mt-1">Network saturation by subscription category</p>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {categoryDistribution.length === 0 ? (
                <div className="text-center py-10 opacity-30 italic">Calculating metrics...</div>
              ) : (
                <div className="grid gap-6">
                  {categoryDistribution.map((cat, idx) => (
                    <div key={cat.name} className="space-y-3 group">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <span>{cat.name}</span>
                        <span className="text-slate-900 font-black">{cat.count} members</span>
                      </div>
                      <div className="h-4 bg-slate-100/50 rounded-full overflow-hidden shadow-inner p-1 backdrop-blur-sm border border-slate-200/50">
                        <div
                          className={cn("h-full rounded-full transition-all duration-1000 shadow-sm", categoryColors[idx % categoryColors.length])}
                          style={{ width: `${(cat.count / (stats.totalMembers || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-premium h-full">
            <CardHeader className="p-8 header-gradient-emerald border-b border-emerald-100/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-serif font-black text-slate-900">Executive Brief: Latest Arrivals</CardTitle>
                <p className="text-slate-400 text-sm font-medium mt-1">Recently onboarded network participants</p>
              </div>
              <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all rounded-full hover:bg-primary/5 px-6" onClick={() => navigate('/admin/members')}>Registry</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50/50">
                {recentMembers.map((m) => (
                  <div key={m.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-[1.25rem] bg-slate-50 border border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 group-hover:shadow-[0_10px_20px_rgba(37,99,235,0.3)] group-hover:scale-105 transition-all duration-500 text-lg">
                        {m.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 lowercase capitalize group-hover:translate-x-1 transition-transform duration-500">{m.full_name}</p>
                        <Badge className="bg-blue-50/50 text-blue-700 border-blue-100 font-black text-[9px] uppercase tracking-tighter mt-1 h-5 px-2 backdrop-blur-sm">{m.membership_categories?.name || 'Standard'}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest bg-white/50 border-slate-200 text-slate-400 mb-1 backdrop-blur-sm">ID: {m.member_number}</Badge>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-1 opacity-60">{new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}