import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users,
    CreditCard,
    Activity,
    TrendingUp,
    DollarSign,
    Calendar
} from "lucide-react";

export default function AuditorDashboard() {
    const [highCostMembers, setHighCostMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Placeholder data - will be replaced with real data fetch
    const stats = [
        { title: "Total Revenue", value: "KES 0", icon: DollarSign, description: "All branches" },
        { title: "Active Members", value: "0", icon: Users, description: "Total registered" },
        { title: "Visits Today", value: "0", icon: Activity, description: "Across all branches" },
        { title: "Total P&L", value: "KES 0", icon: TrendingUp, description: "Net Performance" },
    ];

    useEffect(() => {
        fetchHighCostMembers();
    }, []);

    const fetchHighCostMembers = async () => {
        // Mocking this aggregation for now as it requires complex join/grouping
        // In reality, this would be an RPC or a view.
        // For demonstration, fetching recent visits with high costs
        const { data } = await supabase
            .from("visits")
            .select("benefit_deducted, members(full_name, membership_level)")
            .order("benefit_deducted", { ascending: false })
            .limit(5);

        if (data) setHighCostMembers(data);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Auditor Dashboard</h1>
                    <p className="text-muted-foreground">Overview of financial and operational metrics</p>
                </div>
                <div className="flex gap-2">
                    <select className="h-9 w-[150px] rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus:ring-1 focus:ring-ring">
                        <option>All Branches</option>
                        {/* Populate dynamically */}
                    </select>
                    <select className="h-9 w-[150px] rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus:ring-1 focus:ring-ring">
                        <option>Last 30 Days</option>
                        <option>This Month</option>
                        <option>This Year</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Profit & Loss Heatmap (Branch Performance)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-md bg-slate-50">
                            {/* Placeholder for complex heatmap viz */}
                            <div className="text-center">
                                <p>Visual representation of P&L across branches.</p>
                                <p className="text-xs">Higher green = Profit, Red = Loss</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>High Cost Members</CardTitle>
                        <p className="text-xs text-muted-foreground">Top benefits usage recently</p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {highCostMembers.map((item, i) => (
                                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{item.members?.full_name}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{item.members?.membership_level?.replace('_', ' ')}</p>
                                    </div>
                                    <div className="font-bold text-red-600">
                                        - KES {item.benefit_deducted?.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                            {highCostMembers.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
