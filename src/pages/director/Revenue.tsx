import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, CalendarDays, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1);
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [directorBranchId, setDirectorBranchId] = useState<string | null>(null);
    const [staffId, setStaffId] = useState<string | null>(null);
    const [accumulatedRevenue, setAccumulatedRevenue] = useState(0);
    const [availableToClaim, setAvailableToClaim] = useState(0);
    const [claims, setClaims] = useState<any[]>([]);
    const [pendingMultiStageClaims, setPendingMultiStageClaims] = useState<any[]>([]);
    const [claiming, setClaiming] = useState(false);
    const [doctorBreakdown, setDoctorBreakdown] = useState<any[]>([]);
    const [serviceBreakdown, setServiceBreakdown] = useState<any[]>([]);
    const [patientTypeBreakdown, setPatientTypeBreakdown] = useState<{ principal: number, dependant: number }>({ principal: 0, dependant: 0 });
    const [detailedBills, setDetailedBills] = useState<any[]>([]);
    const { toast } = useToast();
    const navigate = useNavigate();

    const fetchClaims = useCallback(async (branchId: string) => {
        // Fetch Regular Claims
        const { data: regClaims, error } = await (supabase as any)
            .from("revenue_claims")
            .select("*")
            .eq("branch_id", branchId)
            .order("created_at", { ascending: false });

        if (!error) setClaims(regClaims || []);

        // Fetch Pending/Unlocked Multi-Stage Claims
        const { data: pending, error: pendingError } = await (supabase as any)
            .from("pending_claims")
            .select("*, services(name, stage_names), members(full_name)")
            .eq("branch_id", branchId)
            .eq("released_to_director", true)
            .eq("approved_by_director", false)
            .order("updated_at", { ascending: false });

        if (pending) setPendingMultiStageClaims(pending);

    }, []);

    const fetchAccumulatedRevenue = useCallback(async (branchId: string) => {
        try {
            const { data: bills, error: billsErr } = await supabase
                .from("bills")
                .select("total_branch_compensation")
                .eq("branch_id", branchId)
                .eq("is_finalized", true)
                .eq("is_claimable", true);

            if (billsErr) throw billsErr;

            const totalMade = (bills || []).reduce((sum, b) => sum + (Number(b.total_branch_compensation) || 0), 0);

            const { data: claimsData, error: claimErr } = await (supabase as any)
                .from("revenue_claims")
                .select("amount, status")
                .eq("branch_id", branchId)
                .in("status", ["pending", "approved", "paid"]);

            if (claimErr) {
                setAccumulatedRevenue(totalMade);
                setAvailableToClaim(totalMade);
                return;
            }

            const totalPaid = (claimsData || []).filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + Number(c.amount), 0);
            const totalPending = (claimsData || []).filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + Number(c.amount), 0);
            const totalApproved = (claimsData || []).filter((c: any) => c.status === 'approved').reduce((sum: number, c: any) => sum + Number(c.amount), 0);

            setAccumulatedRevenue(Math.max(0, totalMade - totalPaid));
            setAvailableToClaim(Math.max(0, totalMade - (totalPaid + totalPending + totalApproved)));
        } catch (error: any) {
            console.error("Error fetching accumulated revenue:", error);
        }
    }, []);

    const fetchRevenueData = useCallback(async (branchId: string, month: number, year: number) => {
        setLoading(true);
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd") + "T23:59:59";

        try {
            // Fetch all finalized bills for the period
            const { data: allBills, error: billsErr } = await supabase
                .from("bills")
                .select(`
                    id, 
                    created_at, 
                    total_branch_compensation, 
                    total_profit_loss, 
                    visits(
                        id,
                        assigned_doctor_id, 
                        dependant_id, 
                        members(full_name), 
                        dependants(full_name), 
                        staff:assigned_doctor_id(full_name)
                    )
                `)
                .eq("branch_id", branchId)
                .gte("created_at", startOfMonthDate)
                .lte("created_at", endOfMonthDate)
                .eq("is_finalized", true);

            if (billsErr) throw billsErr;
            setDetailedBills(allBills || []);

            // 1. Daily Breakdown (Billed)
            const groupedData: Record<string, BranchRevenueEntry> = {};
            (allBills || []).forEach(bill => {
                const dateKey = format(new Date(bill.created_at), "yyyy-MM-dd");
                if (!groupedData[dateKey]) {
                    groupedData[dateKey] = { date: dateKey, total_compensation: 0, total_profit_loss: 0, visit_count: 0 };
                }
                groupedData[dateKey].total_compensation += Number(bill.total_branch_compensation) || 0;
                groupedData[dateKey].total_profit_loss += Number(bill.total_profit_loss) || 0;
                groupedData[dateKey].visit_count += 1;
            });

            setRevenueData(Object.values(groupedData).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            // 2. Doctor Breakdown (Billed)
            const docGroup: Record<string, any> = {};
            (allBills || []).forEach((b: any) => {
                const docId = b.visits?.assigned_doctor_id || 'unassigned';
                const docName = b.visits?.staff?.full_name || 'Unassigned/Staff';
                if (!docGroup[docId]) {
                    docGroup[docId] = { id: docId, name: docName, total: 0, count: 0 };
                }
                docGroup[docId].total += Number(b.total_branch_compensation) || 0;
                docGroup[docId].count += 1;
            });
            setDoctorBreakdown(Object.values(docGroup).sort((a, b) => b.total - a.total));

            // 3. Service Breakdown (Billed Items)
            if (allBills && allBills.length > 0) {
                const billIds = allBills.map(b => b.id);
                const { data: items } = await (supabase as any)
                    .from("bill_items")
                    .select("service_name, branch_compensation")
                    .in("bill_id", billIds);

                const svcGroup: Record<string, any> = {};
                (items || []).forEach((item: any) => {
                    const name = item.service_name;
                    if (!svcGroup[name]) {
                        svcGroup[name] = { name, total: 0, count: 0 };
                    }
                    svcGroup[name].total += Number(item.branch_compensation) || 0;
                    svcGroup[name].count += 1;
                });
                setServiceBreakdown(Object.values(svcGroup).sort((a, b) => b.total - a.total));
            } else {
                setServiceBreakdown([]);
            }

            // 4. Patient Type Breakdown (Billed)
            let principalRevenue = 0;
            let dependantRevenue = 0;
            (allBills || []).forEach((b: any) => {
                if (b.visits?.dependant_id) dependantRevenue += Number(b.total_branch_compensation) || 0;
                else principalRevenue += Number(b.total_branch_compensation) || 0;
            });
            setPatientTypeBreakdown({ principal: principalRevenue, dependant: dependantRevenue });
        } catch (error: any) {
            toast({ title: "Error fetching revenue data", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchDirectorInfo = useCallback(async () => {
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
    }, [navigate, toast]);

    useEffect(() => {
        fetchDirectorInfo();
    }, [fetchDirectorInfo]);

    useEffect(() => {
        if (directorBranchId) {
            fetchRevenueData(directorBranchId, currentMonth, currentYear);
            fetchAccumulatedRevenue(directorBranchId);
            fetchClaims(directorBranchId);
        }
    }, [directorBranchId, currentMonth, currentYear, fetchRevenueData, fetchAccumulatedRevenue, fetchClaims]);

    const handleSubmitClaim = async () => {
        if (availableToClaim <= 0) {
            toast({ title: "No Available Revenue", description: "All unpaid revenue is already tied to a pending or approved claim.", variant: "destructive" });
            return;
        }

        setClaiming(true);
        try {
            const { error: claimError } = await (supabase as any)
                .from("revenue_claims")
                .insert({
                    branch_id: directorBranchId,
                    director_id: staffId,
                    amount: availableToClaim,
                    status: 'pending'
                });

            if (claimError) throw claimError;

            toast({ title: "Claim Submitted", description: `Claim for KES ${availableToClaim.toLocaleString()} submitted successfully.` });
            if (directorBranchId) {
                fetchAccumulatedRevenue(directorBranchId);
                fetchClaims(directorBranchId);
            }
        } catch (error: any) {
            toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        } finally {
            setClaiming(false);
        }
    };

    const handleApprovePendingClaim = async (claimId: string, amount: number) => {
        if (!claimId) return;
        try {
            setClaiming(true);
            // 1. Mark pending_claim as approved
            const { error: claimErr } = await (supabase as any)
                .from("pending_claims")
                .update({ approved_by_director: true, status: 'approved' })
                .eq("id", claimId);

            if (claimErr) throw claimErr;

            // 2. Mark the original bill as claimable now that the director has approved the work
            const claimObj = pendingMultiStageClaims.find(c => c.id === claimId);
            if (claimObj && claimObj.bill_id) {
                await (supabase as any)
                    .from("bills")
                    .update({ is_claimable: true })
                    .eq("id", claimObj.bill_id);
            }

            // 2. Insert into revenue_claims (Realized Revenue) or just let it flow into accumulated revenue?
            // The user requirement said: "Move locked amount into branch compensation".
            // Since accumulated revenue is calculated from finalized bills, and the bill was ALREADY finalized at Stage 1,
            // the money is technically already in "bills" table. 
            // However, our fetchAccumulatedRevenue might need to account for this lock.
            // Let's assume we just want to create a revenue_claim now.

            // Wait, usually the director claims a lump sum. 
            // If we just unlock it, it becomes part of "Accumulated Revenue" pool.
            // So we don't necessarily need to create a revenue_claim immediately, UNLESS the user wants to cash it out immediately.
            // The requirement says: "Move locked amount into branch compensation". 
            // This implies it joins the pool.

            toast({ title: "Funds Unlocked", description: `KES ${amount.toLocaleString()} has been added to available branch compensation.` });

            if (directorBranchId) {
                fetchClaims(directorBranchId);
                fetchAccumulatedRevenue(directorBranchId); // This should now reflect the unlocked amount if we filter correctly
            }

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setClaiming(false);
        }
    };

    const getMonthOptions = () => {
        const options = [];
        let date = new Date();
        for (let i = 0; i < 12; i++) {
            options.push(date);
            date = subMonths(date, 1);
        }
        return options.reverse();
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    const hasApprovedClaim = claims.some(c => c.status === 'approved');
    const hasPendingClaim = claims.some(c => c.status === 'pending');

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/director">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
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
                        <div className="p-10 flex flex-col items-center justify-center bg-white">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <DollarSign className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-4xl font-extrabold text-primary mb-1">KES {accumulatedRevenue.toLocaleString()}</h3>
                            <p className="text-base text-muted-foreground font-semibold mb-6">Unclaimed Branch Revenue</p>
                            <div className="w-full max-w-sm">
                                {availableToClaim > 0 ? (
                                    <Button
                                        className="w-full h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all"
                                        disabled={claiming}
                                        onClick={handleSubmitClaim}
                                    >
                                        {claiming ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                                        Submit Claim (KES {availableToClaim.toLocaleString()})
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full h-14 text-lg font-bold shadow-md bg-slate-100 text-slate-400"
                                        disabled
                                    >
                                        All Revenue Claimed
                                    </Button>
                                )}

                                {(hasApprovedClaim || hasPendingClaim) && (
                                    <div className="mt-4 space-y-2">
                                        {hasPendingClaim && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-700">
                                                <Clock className="h-4 w-4 animate-pulse shrink-0" />
                                                <div className="text-left">
                                                    <p className="text-xs font-bold">Claim Pending Approval</p>
                                                    <p className="text-[10px] opacity-80">Admin is reviewing your previous claim.</p>
                                                </div>
                                            </div>
                                        )}
                                        {hasApprovedClaim && (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-700">
                                                <Clock className="h-4 w-4 animate-pulse shrink-0" />
                                                <div className="text-left">
                                                    <p className="text-xs font-bold">Approved, Waiting Payment</p>
                                                    <p className="text-[10px] opacity-80">Finance is processing your payout.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {availableToClaim < accumulatedRevenue && accumulatedRevenue > 0 && !hasApprovedClaim && !hasPendingClaim && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                        <p className="text-xs text-blue-700 text-center font-medium">
                                            KES {(accumulatedRevenue - availableToClaim).toLocaleString()} tied to other claims
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-10 flex flex-col items-center justify-center bg-blue-50/20">
                            <div className="bg-blue-100 p-4 rounded-full mb-4">
                                <CalendarDays className="h-10 w-10 text-blue-600" />
                            </div>
                            <h3 className="text-4xl font-extrabold text-blue-900 mb-1">KES {revenueData.reduce((s, e) => s + e.total_compensation, 0).toLocaleString()}</h3>
                            <p className="text-base text-muted-foreground font-semibold mb-2 text-center">
                                Monthly Compensation for {format(new Date(currentYear, currentMonth - 1), "MMMM")}
                            </p>
                            <Badge variant="secondary" className="px-3 py-1 text-sm bg-blue-100 text-blue-700 border-blue-200">
                                {revenueData.reduce((s, e) => s + e.visit_count, 0)} Total Visits
                            </Badge>

                            <div className="mt-8 w-full max-w-sm space-y-4">
                                <div className="flex justify-between text-sm font-bold text-slate-700">
                                    <span>Principal Members</span>
                                    <span>KES {patientTypeBreakdown.principal.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full transition-all duration-1000"
                                        style={{ width: `${(patientTypeBreakdown.principal / (patientTypeBreakdown.principal + patientTypeBreakdown.dependant || 1)) * 100}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-sm font-bold text-slate-700">
                                    <span>Dependants</span>
                                    <span>KES {patientTypeBreakdown.dependant.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-purple-600 h-full transition-all duration-1000"
                                        style={{ width: `${(patientTypeBreakdown.dependant / (patientTypeBreakdown.principal + patientTypeBreakdown.dependant || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="text-lg">Revenue by Doctor</CardTitle>
                        <CardDescription>Top performing practitioners this month</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {doctorBreakdown.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8 font-medium">No doctor data available.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Doctor</TableHead>
                                        <TableHead className="text-right">Revenue (KES)</TableHead>
                                        <TableHead className="text-right">Visits</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {doctorBreakdown.map((doc) => (
                                        <TableRow key={doc.id} className="hover:bg-slate-50/50">
                                            <TableCell className="font-semibold text-slate-800">{doc.name}</TableCell>
                                            <TableCell className="text-right font-bold text-emerald-600">KES {doc.total.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium text-slate-500">{doc.count}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-100">
                    <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="text-lg">Revenue by Service</CardTitle>
                        <CardDescription>Breakdown of treatments generating revenue</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {serviceBreakdown.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8 font-medium">No service data available.</p>
                        ) : (
                            <div className="max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Service</TableHead>
                                            <TableHead className="text-right">Revenue (KES)</TableHead>
                                            <TableHead className="text-right">Freq</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {serviceBreakdown.map((svc) => (
                                            <TableRow key={svc.name} className="hover:bg-slate-50/50">
                                                <TableCell className="text-sm font-medium text-slate-700">{svc.name}</TableCell>
                                                <TableCell className="text-right font-bold text-blue-600">KES {svc.total.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-medium text-slate-400">{svc.count}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-100">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-lg">Detailed Visit Revenue</CardTitle>
                    <CardDescription>Individual breakdown of revenue generated per visit</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {detailedBills.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 font-medium">No visit records found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Assigned Doctor</TableHead>
                                        <TableHead className="text-right">Amount (KES)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {detailedBills.map((bill) => {
                                        const patientName = bill.visits?.dependants?.full_name
                                            ? `${bill.visits.dependants.full_name} (Dep)`
                                            : (bill.visits?.members?.full_name || "Unknown");
                                        const doctorName = bill.visits?.staff?.full_name || "Unassigned";

                                        return (
                                            <TableRow key={bill.id} className="hover:bg-slate-50/50">
                                                <TableCell className="text-sm">
                                                    {format(new Date(bill.created_at), 'MMM d, h:mm a')}
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-800">
                                                    {patientName}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-500">
                                                    {doctorName}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-emerald-600">
                                                    KES {Number(bill.total_branch_compensation).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-lg">Daily Revenue Log</CardTitle>
                    <CardDescription>Day-by-day financial performance</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
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
                                            <td className="py-3 px-3 text-sm text-blue-700 text-right font-medium font-bold">KES {entry.total_compensation.toLocaleString()}</td>
                                            <td className="py-3 pl-3 text-sm text-right font-medium">{entry.visit_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending Multi-Stage Claims Section */}
            {pendingMultiStageClaims.length > 0 && (
                <Card className="shadow-md border-amber-200 bg-amber-50/30 mt-6">
                    <CardHeader>
                        <CardTitle className="text-amber-800 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5" />
                            Completed Multi-Stage Services (Action Required)
                        </CardTitle>
                        <CardDescription>These services are complete. Approve them to release funds to branch revenue.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date Completed</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Locked Amount</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingMultiStageClaims.map((claim) => (
                                    <TableRow key={claim.id} className="bg-white">
                                        <TableCell>{format(new Date(claim.updated_at), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{claim.members?.full_name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{claim.services?.name}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                                    Final Stage: {claim.services?.stage_names?.[claim.services.stage_names.length - 1] || "Complete"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-amber-700">KES {Number(claim.locked_amount).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                                onClick={() => handleApprovePendingClaim(claim.id, claim.locked_amount)}
                                                disabled={claiming}
                                            >
                                                {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Approve & Release
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-sm border-slate-100 mt-6">
                <CardHeader><CardTitle>Claims History</CardTitle></CardHeader>
                <CardContent>
                    {claims.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No claims history found.</p>
                    ) : (
                        <div className="overflow-x-auto">
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
                                                        claim.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-amber-100 text-amber-800'
                                                }>
                                                    {claim.status === 'approved' ? 'APPROVED (WAITING FOR PAYMENT)' : claim.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{claim.paid_at ? format(new Date(claim.paid_at), 'MMM d, yyyy') : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}