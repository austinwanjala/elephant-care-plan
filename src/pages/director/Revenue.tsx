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


    const [stats, setStats] = useState({ compensation: 0, profit_loss: 0, visits: 0 });
    const [submittingClaim, setSubmittingClaim] = useState(false);
    const [claimAmount, setClaimAmount] = useState("");
    const [claimNotes, setClaimNotes] = useState("");
    const [showClaimModal, setShowClaimModal] = useState(false);

    useEffect(() => {
        if (directorBranchId) {
            fetchRevenueData(directorBranchId, currentMonth, currentYear);
        }
    }, [directorBranchId, currentMonth, currentYear]);

    const fetchRevenueData = async (branchId: string, month: number, year: number) => {
        setLoading(true);
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd");

        // Fetch daily breakdown
        const { data, error } = await supabase
            .from("branch_revenue")
            .select("*")
            .eq("branch_id", branchId)
            .gte("date", startOfMonthDate)
            .lte("date", endOfMonthDate)
            .order("date", { ascending: false });

        if (error) {
            console.error("Error fetching revenue:", error);
            setRevenueData([]);
        } else {
            setRevenueData(data || []);
        }

        // Calculate totals locally from the fetched daily data
        const totalComp = (data || []).reduce((acc, curr) => acc + (curr.total_compensation || 0), 0);
        const totalPL = (data || []).reduce((acc, curr) => acc + (curr.total_profit_loss || 0), 0);
        const totalVisits = (data || []).reduce((acc, curr) => acc + (curr.visit_count || 0), 0);

        setStats({
            compensation: totalComp,
            profit_loss: totalPL,
            visits: totalVisits
        });

        setLoading(false);
    };

    const handleClaimSubmit = async () => {
        if (!claimAmount || isNaN(Number(claimAmount)) || Number(claimAmount) <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
            return;
        }
        if (!directorBranchId) return;

        setSubmittingClaim(true);
        try {
            const { error } = await supabase.from("branch_claims").insert({
                branch_id: directorBranchId,
                amount: Number(claimAmount),
                notes: claimNotes,
                period_start: format(new Date(currentYear, currentMonth - 1, 1), "yyyy-MM-dd"),
                period_end: format(new Date(currentYear, currentMonth, 0), "yyyy-MM-dd"),
            });

            if (error) throw error;

            toast({ title: "Claim Submitted", description: "Your compensation claim has been sent to admin." });
            setShowClaimModal(false);
            setClaimAmount("");
            setClaimNotes("");
        } catch (error: any) {
            toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmittingClaim(false);
        }
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

    if (loading && !directorBranchId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
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
                <Button onClick={() => setShowClaimModal(true)} className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="mr-2 h-4 w-4" /> Request Compensation
                </Button>
            </div>

            <Card className="shadow-sm border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Summary ({format(new Date(currentYear, currentMonth - 1, 1), "MMMM yyyy")})</CardTitle>
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
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 text-center bg-blue-50/50">
                        <DollarSign className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-700">KES {stats.compensation.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Compensation Generated</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center bg-orange-50/50">
                        <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                        <p className={`text-2xl font-bold ${stats.profit_loss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            KES {stats.profit_loss.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Net Profit/Loss</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center bg-emerald-50/50">
                        <CalendarDays className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-emerald-700">{stats.visits}</p>
                        <p className="text-xs text-muted-foreground">Total Visits</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100">
                <CardHeader>
                    <CardTitle>Daily Revenue Breakdown</CardTitle>
                    <CardDescription>Daily financial logs.</CardDescription>
                </CardHeader>
                <CardContent>
                    {revenueData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No revenue data for this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] divide-y divide-border">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground bg-muted/20">
                                        <th className="py-3 pl-4 font-semibold rounded-l-lg">Date</th>
                                        <th className="py-3 px-3 font-semibold">Compensation</th>
                                        <th className="py-3 px-3 font-semibold">Profit/Loss</th>
                                        <th className="py-3 pr-4 font-semibold text-right rounded-r-lg">Visits</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {revenueData.map(entry => (
                                        <tr key={entry.date} className="hover:bg-muted/50 transition-colors">
                                            <td className="py-3 pl-4 text-sm font-medium">{format(new Date(entry.date), 'MMM d, yyyy')}</td>
                                            <td className="py-3 px-3 text-sm text-blue-700 bg-blue-50/30">KES {entry.total_compensation.toLocaleString()}</td>
                                            <td className={`py-3 px-3 text-sm ${entry.total_profit_loss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                KES {entry.total_profit_loss.toLocaleString()}
                                            </td>
                                            <td className="py-3 pr-4 text-sm text-right">{entry.visit_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Claim Modal */}
            {showClaimModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle>Request Compensation</CardTitle>
                            <CardDescription>Submit a claim for branch compensation.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount (KES)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="number"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="0.00"
                                        value={claimAmount}
                                        onChange={(e) => setClaimAmount(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notes (Optional)</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Add any details about this claim..."
                                    value={claimNotes}
                                    onChange={(e) => setClaimNotes(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={() => setShowClaimModal(false)} disabled={submittingClaim}>Cancel</Button>
                                <Button onClick={handleClaimSubmit} disabled={submittingClaim}>
                                    {submittingClaim ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Claim"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}