import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, TrendingUp, CalendarDays } from "lucide-react";
import { format, getMonth, getYear, subMonths } from "date-fns";

interface BranchRevenueEntry {
    date: string;
    total_compensation: number;
    total_profit_loss: number;
    visit_count: number;
}

export default function DirectorRevenue() {
    const [loading, setLoading] = useState(true);
    const [revenueData, setRevenueData] = useState<BranchRevenueEntry[]>([]);
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1); // 1-indexed
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [directorBranchId, setDirectorBranchId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDirectorInfo();
    }, []);

    useEffect(() => {
        if (directorBranchId) {
            fetchRevenueData(directorBranchId, currentMonth, currentYear);
        }
    }, [directorBranchId, currentMonth, currentYear]);

    const fetchDirectorInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData?.branch_id) {
            toast({ title: "Access Denied", description: "You are not assigned to a branch.", variant: "destructive" });
            navigate("/");
            return;
        }
        setDirectorBranchId(staffData.branch_id);
    };

    const fetchRevenueData = async (branchId: string, month: number, year: number) => {
        setLoading(true);
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd"); // Last day of the month

        const { data, error } = await supabase
            .from("branch_revenue")
            .select("*")
            .eq("branch_id", branchId)
            .gte("date", startOfMonthDate)
            .lte("date", endOfMonthDate)
            .order("date", { ascending: false });

        if (error) {
            toast({ title: "Error fetching revenue data", description: error.message, variant: "destructive" });
            setRevenueData([]);
        } else {
            setRevenueData(data || []);
        }
        setLoading(false);
    };

    const getMonthOptions = () => {
        const options = [];
        let date = new Date();
        for (let i = 0; i < 12; i++) { // Last 12 months
            options.push(date);
            date = subMonths(date, 1);
        }
        return options.reverse();
    };

    const totalMonthlyCompensation = revenueData.reduce((sum, entry) => sum + entry.total_compensation, 0);
    const totalMonthlyProfitLoss = revenueData.reduce((sum, entry) => sum + entry.total_profit_loss, 0);
    const totalMonthlyVisits = revenueData.reduce((sum, entry) => sum + entry.visit_count, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/director">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Branch Revenue</h1>
                    <p className="text-muted-foreground">Detailed financial overview for your branch.</p>
                </div>
            </div>

            <Card className="shadow-sm border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Summary</CardTitle>
                    <Select
                        value={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                        onValueChange={(value) => {
                            const [yearStr, monthStr] = value.split('-');
                            setCurrentYear(parseInt(yearStr));
                            setCurrentMonth(parseInt(monthStr));
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                            {getMonthOptions().map((date, index) => (
                                <SelectItem key={index} value={`${getYear(date)}-${(getMonth(date) + 1).toString().padStart(2, '0')}`}>
                                    {format(date, "MMM yyyy")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 text-center">
                        <DollarSign className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-lg font-bold">KES {totalMonthlyCompensation.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Compensation</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                        <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                        <p className={`text-lg font-bold ${totalMonthlyProfitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            KES {totalMonthlyProfitLoss.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Net Profit/Loss</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                        <CalendarDays className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                        <p className="text-lg font-bold">{totalMonthlyVisits}</p>
                        <p className="text-xs text-muted-foreground">Total Visits</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100">
                <CardHeader>
                    <CardTitle>Daily Revenue Breakdown</CardTitle>
                    <CardDescription>Detailed daily compensation and profit/loss for {format(new Date(currentYear, currentMonth - 1), "MMM yyyy")}.</CardDescription>
                </CardHeader>
                <CardContent>
                    {revenueData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No revenue data for this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] divide-y divide-border">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground">
                                        <th className="py-3 pr-3 font-semibold">Date</th>
                                        <th className="py-3 px-3 font-semibold">Compensation</th>
                                        <th className="py-3 px-3 font-semibold">Profit/Loss</th>
                                        <th className="py-3 pl-3 font-semibold text-right">Visits</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {revenueData.map(entry => (
                                        <tr key={entry.date} className="hover:bg-muted/50">
                                            <td className="py-3 pr-3 text-sm">{format(new Date(entry.date), 'MMM d, yyyy')}</td>
                                            <td className="py-3 px-3 text-sm text-blue-700">KES {entry.total_compensation.toLocaleString()}</td>
                                            <td className={`py-3 px-3 text-sm ${entry.total_profit_loss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                KES {entry.total_profit_loss.toLocaleString()}
                                            </td>
                                            <td className="py-3 pl-3 text-sm text-right">{entry.visit_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}