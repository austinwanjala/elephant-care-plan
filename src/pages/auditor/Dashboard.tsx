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
    // Placeholder data - will be replaced with real data fetch
    const stats = [
        { title: "Total Revenue", value: "KES 0", icon: DollarSign, description: "All branches" },
        { title: "Active Members", value: "0", icon: Users, description: "Total registered" },
        { title: "Visits Today", value: "0", icon: Activity, description: "Across all branches" },
        { title: "Total P&L", value: "KES 0", icon: TrendingUp, description: "Net Performance" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Auditor Dashboard</h1>
                <p className="text-muted-foreground">Overview of financial and operational metrics</p>
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
                        <CardTitle>Revenue Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-md">
                            Revenue Chart Area
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            <div className="flex items-center">
                                <div className="ml-4 space-y-1">
                                    <p className="text-sm font-medium leading-none">System Logs</p>
                                    <p className="text-sm text-muted-foreground">
                                        View detailed logs in the Logs tab.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
