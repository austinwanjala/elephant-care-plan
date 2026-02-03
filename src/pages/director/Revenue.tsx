import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, TrendingUp, CalendarDays, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, getMonth, getYear, subMonths, startOfMonth, endOfMonth } from "date-fns";

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
    const [staffId, setStaffId] = useState<string | null>(null);
    const [accumulatedRevenue, setAccumulatedRevenue] = useState(0);
    const [claims, setClaims] = useState<any[]>([]);
    const [claiming, setClaiming] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDirectorInfo();
    }, []);

    useEffect(() => {
        if (directorBranchId) {
            fetchRevenueData(directorBranchId, currentMonth, currentYear);
            fetchAccumulatedRevenue(directorBranchId);
            fetchClaims(directorBranchId);
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
            .select("id, branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData?.branch_id) {
            toast({ title: "Access Denied", description: "You are not assigned to a branch.", variant: "destructive" });
            navigate("/");
            return;
        }
        setDirectorBranchId(staffData.branch_id);
        setStaffId(staffData.id);
    };

    const fetchAccumulatedRevenue = async (branchId: string) => {
        // Calculate accumulated revenue as: (Total Revenue Made from Bills) - (Total Claims Submitted)
        // This directly tallies total branch compensation made from the services.
        try {
            const [billsRes, claimRes] = await Promise.all([
                (supabase.from("bills" as any))
                    .select("total_branch_compensation")
                    .eq("branch_id", branchId),
                (supabase.from("revenue_claims" as any))
                    .select("amount")
                    .eq("branch_id", branchId)
                    .in("status", ["pending", "paid"])
            ]);

            if (billsRes.error) throw billsRes.error;
            if (claimRes.error) throw claimRes.error;

            const totalMade = (billsRes.data as any[] || []).reduce((sum, b) => sum + Number(b.total_branch_compensation), 0);
            const totalClaimed = (claimRes.data as any[] || []).reduce((sum, c) => sum + Number(c.amount), 0);

            setAccumulatedRevenue(Math.max(0, totalMade - totalClaimed));
        } catch (error: any) {
            console.error("Error fetching accumulated revenue:", error);
        }
    };

    const fetchClaims = async (branchId: string) => {
        const { data, error } = await (supabase.from("revenue_claims" as any))
            .select("*")
            .eq("branch_id", branchId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching claims:", error);
        } else {
            setClaims(data || []);
        }
    };

    const handleSubmitClaim = async () => {
        if (accumulatedRevenue <= 0) {
            toast({ title: "No Revenue", description: "There is no accumulated revenue to claim.", variant: "destructive" });
            return;
        }

        setClaiming(true);
        try {
            // 1. Create the claim
            const { data: claim, error: claimError } = await (supabase.from("revenue_claims" as any))
                .insert({
                    branch_id: directorBranchId,
                    director_id: staffId,
                    amount: accumulatedRevenue,
                    status: 'pending'
                })
                .select()
                .single();

            if (claimError) throw claimError;

            // 2. Link all un-claimed finalized bills to this claim for record keeping
            const { data: billsToLink } = await (supabase.from("bills" as any))
                .select("id")
                .eq("branch_id", directorBranchId)
                .eq("is_finalized", true)
                .is("claim_id", null);

            if (billsToLink && (billsToLink as any[]).length > 0) {
                const billIds = (billsToLink as any[]).map((b: any) => b.id);
                await (supabase.from("bills" as any))
                    .update({ claim_id: (claim as any).id })
                    .in("id", billIds);
            }

            toast({ title: "Claim Submitted", description: `Claim for KES ${accumulatedRevenue.toLocaleString()} submitted successfully.` });
            fetchAccumulatedRevenue(directorBranchId!);
            fetchClaims(directorBranchId!);
        } catch (error: any) {
            toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        } finally {
            setClaiming(false);
        }
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
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border-2 border-primary/20 bg-primary/5 rounded-xl p-6 text-center shadow-sm">
                            <DollarSign className="h-8 w-8 text-primary mx-auto mb-2" />
                            <p className="text-3xl font-bold text-primary">KES {accumulatedRevenue.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground font-medium mb-4">Unclaimed Branch Compensation</p>
                            <Button
                                className="w-full bg-primary hover:bg-primary/90"
                                disabled={claiming || accumulatedRevenue <= 0}
                                onClick={handleSubmitClaim}
                            >
                                {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                                Submit Compensation Claim
                            </Button>
                            {accumulatedRevenue === 0 && (
                                <p className="text-[10px] text-amber-600 mt-3 italic">
                                    * Note: Only finalized bills from the receptionist portal can be claimed.
                                    Consultation bills must be approved and finalized to appear here.
                                </p>
                            )}
                        </div>
                        <div className="border rounded-xl p-6 text-center bg-blue-50/30">
                            <CalendarDays className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <p className="text-3xl font-bold text-blue-900">KES {totalMonthlyCompensation.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground font-medium">Monthly Branch Compensation ({format(new Date(currentYear, currentMonth - 1), "MMM")})</p>
                        </div>
                    </CardContent>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100">
                <CardContent>
                    {revenueData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No revenue data for this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] divide-y divide-border">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground">
                                        <th className="py-3 pr-3 font-semibold">Date</th>
                                        <th className="py-3 px-3 font-semibold text-right">Compensation</th>
                                        <th className="py-3 pl-3 font-semibold text-right">Visits</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {revenueData.map(entry => (
                                        <tr key={entry.date} className="hover:bg-muted/50">
                                            <td className="py-3 pr-3 text-sm">{format(new Date(entry.date), 'MMM d, yyyy')}</td>
                                            <td className="py-3 px-3 text-sm text-blue-700 text-right font-medium">KES {entry.total_compensation.toLocaleString()}</td>
                                            <td className="py-3 pl-3 text-sm text-right">{entry.visit_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100 mt-6">
                <CardHeader>
                    <CardTitle>Claims History</CardTitle>
                    <CardDescription>History of revenue claims submitted to admin.</CardDescription>
                </CardHeader>
                <CardContent>
                    {claims.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No claims history found.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Paid Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {claims.map((claim) => (
                                    <TableRow key={claim.id}>
                                        <TableCell>{format(new Date(claim.created_at), 'MMM d, yyyy')}</TableCell>
                                        <TableCell className="font-bold text-blue-700">KES {claim.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge className={
                                                claim.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                    claim.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-red-100 text-red-800'
                                            }>
                                                {claim.status.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{claim.paid_at ? format(new Date(claim.paid_at), 'MMM d, yyyy') : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}