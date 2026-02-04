import { useState, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  CreditCard,
  Shield,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  UserPlus,
  ClipboardList,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

interface RecentActivity {
  id: string;
  type: 'member' | 'visit' | 'payment';
  description: string;
  timestamp: string;
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

  useEffect(() => {
    loadStats();
    loadRecentMembers();
  }, []);

  const loadStats = async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [membersRes, branchesRes, revenueRes, categoriesRes, visitsRes, marketersRes, newMembersRes] = await Promise.all([
      supabase.from("members").select("coverage_balance, total_contributions, is_active"),
      supabase.from("branches").select("id").eq("is_active", true),
      supabase.from("branch_revenue").select("total_compensation, total_profit_loss"),
      supabase.from("members").select("membership_category_id, membership_categories(name)"),
      supabase.from("visits").select("id"),
      supabase.from("marketers").select("id").eq("is_active", true),
      supabase.from("members").select("id").gte("created_at", startOfMonth.toISOString()),
    ]);

    if (membersRes.data && branchesRes.data && visitsRes.data && marketersRes.data) {
      const revenueData = revenueRes.data || [];
      setStats({
        totalMembers: membersRes.data.length,
        activeMembers: membersRes.data.filter(m => m.is_active).length,
        totalContributions: membersRes.data.reduce((sum, m) => sum + (m.total_contributions || 0), 0),
        totalCoverage: membersRes.data.reduce((sum, m) => sum + (m.coverage_balance || 0), 0),
        totalVisits: visitsRes.data.length,
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

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `KES ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `KES ${(amount / 1000).toFixed(0)}K`;
    return `KES ${amount.toLocaleString()}`;
  };

  return (
<<<<<<< HEAD
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your dental insurance system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">{stats.activeMembers} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {(stats.totalContributions / 1000).toFixed(0)}K
=======
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your dental insurance system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1.5 text-sm bg-primary/5 border-primary/20">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Badge>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Members</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.totalMembers}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                +{stats.newMembersThisMonth} this month
              </Badge>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Active rate</span>
                <span className="font-medium">{stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}%</span>
              </div>
              <Progress value={stats.totalMembers > 0 ? (stats.activeMembers / stats.totalMembers) * 100 : 0} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Contributions */}
        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950 dark:to-emerald-900/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total Contributions</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
              {formatCurrency(stats.totalContributions)}
            </div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-2">
              From {stats.totalMembers} members
            </p>
          </CardContent>
        </Card>

        {/* Active Coverage */}
        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950 dark:to-violet-900/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-300">Active Coverage</CardTitle>
            <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-900 dark:text-violet-100">
              {formatCurrency(stats.totalCoverage)}
            </div>
            <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-2">
              Available benefit pool
            </p>
          </CardContent>
        </Card>

        {/* Profit/Loss */}
        <Card className={`relative overflow-hidden border-0 shadow-md ${
          stats.totalProfitLoss >= 0 
            ? 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/50' 
            : 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950 dark:to-red-900/50'
        }`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${
              stats.totalProfitLoss >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              Net Profit/Loss
            </CardTitle>
            <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
              stats.totalProfitLoss >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {stats.totalProfitLoss >= 0 
                ? <TrendingUp className="h-4 w-4 text-green-600" />
                : <TrendingDown className="h-4 w-4 text-red-600" />
              }
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              stats.totalProfitLoss >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
            }`}>
              {formatCurrency(Math.abs(stats.totalProfitLoss))}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {stats.totalProfitLoss >= 0 
                ? <ArrowUpRight className="h-3 w-3 text-green-600" />
                : <ArrowDownRight className="h-3 w-3 text-red-600" />
              }
              <span className={`text-xs ${stats.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.totalProfitLoss >= 0 ? 'Profitable' : 'Loss'}
              </span>
>>>>>>> 9ce1b7bf4df1d33d0fb034d895010586efa5354c
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coverage</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {(stats.totalCoverage / 1000).toFixed(0)}K
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBranches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {(stats.totalRevenue / 1000).toFixed(0)}K
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit/Loss</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalProfitLoss >= 0 ? "text-success" : "text-destructive"}`}>
              KES {(stats.totalProfitLoss / 1000).toFixed(0)}K
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Marketers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMarketers}</div>
          </CardContent>
        </Card>
      </div>

<<<<<<< HEAD
      {/* Membership Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Membership Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoryDistribution.map((cat) => (
              <div key={cat.name} className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">{cat.count}</p>
                <p className="text-sm text-muted-foreground">{cat.name}</p>
              </div>
            ))}
            {categoryDistribution.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                No members registered yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

=======
      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalVisits}</p>
                <p className="text-xs text-muted-foreground">Total Visits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalBranches}</p>
                <p className="text-xs text-muted-foreground">Active Branches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalMarketers}</p>
                <p className="text-xs text-muted-foreground">Active Marketers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Membership Distribution */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Membership Distribution</CardTitle>
            <CardDescription>Members by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryDistribution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No members registered yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {categoryDistribution.map((cat) => (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${cat.color}`} />
                        <span className="text-sm font-medium">{cat.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{cat.count} members</span>
                    </div>
                    <Progress 
                      value={stats.totalMembers > 0 ? (cat.count / stats.totalMembers) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Members */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Members</CardTitle>
            <CardDescription>Latest member registrations</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No members yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {member.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {(member.membership_categories as any)?.name || 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
>>>>>>> 9ce1b7bf4df1d33d0fb034d895010586efa5354c
  );
}
