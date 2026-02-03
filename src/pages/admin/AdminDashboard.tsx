import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  CreditCard,
  Shield,
  FileText,
  Building2,
  TrendingUp,
  DollarSign,
  UserPlus, // For new members
  ClipboardList, // For total visits
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  totalMembers: number;
  activeMembers: number;
  totalContributions: number;
  totalCoverage: number;
  totalVisits: number; // New stat
  totalBranches: number;
  totalRevenue: number;
  totalProfitLoss: number;
  totalMarketers: number; // New stat
}

interface CategoryDistribution {
  name: string;
  count: number;
}

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
  });
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [membersRes, branchesRes, revenueRes, categoriesRes, visitsRes, marketersRes] = await Promise.all([
      supabase.from("members").select("coverage_balance, total_contributions, is_active"),
      supabase.from("branches").select("id").eq("is_active", true),
      supabase.from("branch_revenue").select("total_compensation, total_profit_loss"),
      supabase.from("members").select("membership_category_id, membership_categories(name)"),
      supabase.from("visits").select("id"), // Fetch all visits
      supabase.from("marketers").select("id").eq("is_active", true), // Fetch active marketers
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
      });
    }

    // Calculate category distribution
    if (categoriesRes.data) {
      const distribution: Record<string, number> = {};
      categoriesRes.data.forEach((m: any) => {
        const name = m.membership_categories?.name || "Uncategorized";
        distribution[name] = (distribution[name] || 0) + 1;
      });
      setCategoryDistribution(
        Object.entries(distribution).map(([name, count]) => ({ name, count }))
      );
    }
  };

  return (
    <AdminLayout>
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
    </AdminLayout>
  );
}