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
    const [accumulatedRevenue, setAccumulatedRevenue] = useState(0); // This is the total UNPAID balance (includes pending)
    const [availableToClaim, setAvailableToClaim] = useState(0); // This is (Total - Paid - Pending)
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
        // DIRECT SUM from visits.branch_compensation
        try {
            const visitRes = await supabase
                .from("visits")
                .select("branch_compensation, status")
                .eq("branch_id", branchId)
                .eq("status", "completed");

            if (visitRes.error) throw visitRes.error;

            const totalMade = (visitRes.data as any[] || []).reduce((sum, visit) => {
                return sum + (Number(visit.branch_compensation) || 0);
            }, 0);

            // Fetch claims separately to prevent failure if table doesn't exist yet
            const { data: claims, error: claimErr } = await (supabase.from("revenue_claims" as any))
                .select("amount, status")
                .eq("branch_id", branchId)
                .in("status", ["pending", "paid"]);

            if (claimErr) {
                console.warn("Could not fetch revenue_claims (table may be missing):", claimErr);
                setAccumulatedRevenue(totalMade);
                setAvailableToClaim(totalMade);
                return;
            }

            const totalPaid = (claims || []).filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0);
            const totalPending = (claims || []).filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0);

            console.log(`Accumulated Revenue Debug - Branch: ${branchId}, Total Made: ${totalMade}, Paid: ${totalPaid}, Pending: ${totalPending}`);

            setAccumulatedRevenue(Math.max(0, totalMade - totalPaid));
            setAvailableToClaim(Math.max(0, totalMade - (totalPaid + totalPending)));
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
        if (availableToClaim <= 0) {
            toast({ title: "No Available Revenue", description: "All unpaid revenue is already tied to a pending claim.", variant: "destructive" });
            return;
        }

        setClaiming(true);
        try {
            // 1. Create the claim
            const { data: claim, error: claimError } = await (supabase.from("revenue_claims" as any))
                .insert({
                    branch_id: directorBranchId,
                    director_id: staffId,
                    amount: availableToClaim,
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
        // Calculate the range for the selected month
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd") + "T23:59:59";

        try {
            const { data, error } = await supabase
                .from("visits")
                .select("id, created_at, status, branch_compensation, profit_loss")
                .eq("branch_id", branchId)
                .gte("created_at", startOfMonthDate)
                .lte("created_at", endOfMonthDate)
                .eq("status", "completed");

            if (error) throw error;

            console.log(`Monthly Revenue Data - Count: ${data?.length || 0} for period ${startOfMonthDate} to ${endOfMonthDate}`);

            // Group by date
            const groupedData: Record<string, BranchRevenueEntry> = {};

            (data || []).forEach(visit => {
                const dateKey = format(new Date(visit.created_at), "yyyy-MM-dd");
                const compensation = Number(visit.branch_compensation) || 0;
                const profitLossValue = Number(visit.profit_loss) || 0;

                if (!groupedData[dateKey]) {
                    groupedData[dateKey] = {
                        date: dateKey,
                        total_compensation: 0,
                        total_profit_loss: 0,
                        visit_count: 0
                    };
                }

                groupedData[dateKey].total_compensation += compensation;
                groupedData[dateKey].total_profit_loss += profitLossValue;
                groupedData[dateKey].visit_count += 1;
            });

            // Convert to array and sort by date descending
            const sortedData = Object.values(groupedData).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setRevenueData(sortedData);
        } catch (error: any) {
            console.error("Error fetching revenue data:", error);
            toast({ title: "Error fetching revenue data", description: error.message, variant: "destructive" });
            setRevenueData([]);
        } finally {
            setLoading(false);
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

            <Card className="shadow-lg border-blue-200 overflow-hidden">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100 flex flex-row items-center justify-between space-y-0 py-4">
                    <CardTitle className="text-lg font-bold text-blue-900">Financial Summary</CardTitle>
                    <Select
                        value={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                        onValueChange={(value) => {
                            const [yearStr, monthStr] = value.split('-');
                            setCurrentYear(parseInt(yearStr));
                            setCurrentMonth(parseInt(monthStr));
                        }}
                    >
                        <SelectTrigger className="w-[200px] h-10 border-blue-200 shadow-sm bg-white">
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                            {getMonthOptions().map((date, index) => (
                                <SelectItem key={index} value={`${getYear(date)}-${(getMonth(date) + 1).toString().padStart(2, '0')}`}>
                                    {format(date, "MMMM yyyy")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-blue-100">
                        {/* Unpaid Compensation Card */}
                        <div className="p-10 flex flex-col items-center justify-center bg-white">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <DollarSign className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-4xl font-extrabold text-primary mb-1">KES {accumulatedRevenue.toLocaleString()}</h3>
                            <p className="text-base text-muted-foreground font-semibold mb-6">Unpaid Compensation</p>

                            <div className="w-full max-w-sm">
                                <Button
                                    className="w-full h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all"
                                    disabled={claiming || availableToClaim <= 0}
                                    onClick={handleSubmitClaim}
                                >
                                    {claiming ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                                    {availableToClaim > 0 ? `Submit Claim (KES ${availableToClaim.toLocaleString()})` : 'All Revenue Claimed'}
                                </Button>

                                {availableToClaim < accumulatedRevenue && accumulatedRevenue > 0 && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                        <p className="text-xs text-blue-700 text-center font-medium">
                                            KES {(accumulatedRevenue - availableToClaim).toLocaleString()} pending approval
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Monthly Summary Card */}
                        <div className="p-10 flex flex-col items-center justify-center bg-blue-50/20">
                            <div className="bg-blue-100 p-4 rounded-full mb-4">
                                <CalendarDays className="h-10 w-10 text-blue-600" />
                            </div>
                            <h3 className="text-4xl font-extrabold text-blue-900 mb-1">KES {totalMonthlyCompensation.toLocaleString()}</h3>
                            <p className="text-base text-muted-foreground font-semibold mb-2 text-center">
                                Monthly Compensation for {format(new Date(currentYear, currentMonth - 1), "MMMM")}
                            </p>
                            <div className="mt-4 flex gap-4">
                                <Badge variant="secondary" className="px-3 py-1 text-sm bg-blue-100 text-blue-700 border-blue-200">
                                    {totalMonthlyVisits} Total Visits
                                </Badge>
                            </div>
                        </div>
                    </div>
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