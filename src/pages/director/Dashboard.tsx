import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    TrendingUp,
    Users,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    TrendingDown,
    Loader2,
    Download
} from "lucide-react";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";

export default function DirectorDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        visits: 0,
        newMembers: 0,
        profitLoss: 0
    });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Placeholder for real analytics queries
            // In a real app, we'd query aggregation views or specific tables
            const today = new Date().toISOString().split('T')[0];

            // Mocking stats for presentation
            setStats({
                revenue: 1250000,
                visits: 45,
                newMembers: 12,
                profitLoss: 850000
            });
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Branch Overview</h1>
                    <p className="text-muted-foreground">Performance and financial analytics for your branch.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline">
                        <Calendar className="mr-2 h-4 w-4" /> This Month
                    </Button>
                    <Button>
                        <Download className="mr-2 h-4 w-4" /> Export Report
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {stats.revenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <span className="text-emerald-600 flex items-center font-medium">
                                <ArrowUpRight className="h-3 w-3" /> +12%
                            </span>
                            from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.visits}</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <span className="text-emerald-600 flex items-center font-medium">
                                <ArrowUpRight className="h-3 w-3" /> +5%
                            </span>
                            from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Members</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.newMembers}</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <span className="text-red-600 flex items-center font-medium">
                                <ArrowDownRight className="h-3 w-3" /> -2%
                            </span>
                            from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.profitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            KES {stats.profitLoss.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Estimated after expenses</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue Analytics</CardTitle>
                        <CardDescription>Daily revenue trends for the current month.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center border-t">
                        <div className="text-muted-foreground flex flex-col items-center">
                            <TrendingUp className="h-12 w-12 mb-2 opacity-20" />
                            <p>Revenue Chart Placeholder</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Doctor Performance</CardTitle>
                        <CardDescription>Visits and revenue per provider.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { name: "Dr. Jane Smith", visits: 120, revenue: 450000 },
                                { name: "Dr. John Doe", visits: 95, revenue: 380000 },
                                { name: "Dr. Alex Wong", visits: 80, revenue: 320000 },
                            ].map((doc, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{doc.name}</p>
                                        <p className="text-xs text-muted-foreground">{doc.visits} visits</p>
                                    </div>
                                    <div className="text-sm font-bold">KES {doc.revenue.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
