import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Users,
    CreditCard,
    Stethoscope,
    TrendingUp,
    Calendar,
    ArrowUpRight,
    Loader2,
    DollarSign,
    ClipboardList,
    Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function AdminReports() {
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
    const [visits, setVisits] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        visitCount: 0,
        newMembers: 0,
        profitLoss: 0,
        totalServices: 0,
        totalAppts: 0,
        completedAppts: 0,
    });
    const { toast } = useToast();

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedBranchId) {
            fetchMetrics(selectedBranchId);
        }
    }, [selectedBranchId]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Fetch branches
            const { data: branchesData } = await supabase.from("branches").select("id, name").order("name");
            setBranches(branchesData || []);

            await fetchMetrics("all");
        } catch (error: any) {
            toast({ title: "Error loading reports", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const fetchMetrics = async (branchId: string) => {
        setLoading(true);
        try {
            const startOfMonthDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
            const endOfMonthDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

            let query = supabase
                .from("visits")
                .select("*, bills(*), members(full_name, member_number), doctor:staff!visits_doctor_id_fkey(full_name)")
                .gte("created_at", startOfMonthDate)
                .lte("created_at", endOfMonthDate)
                .order("created_at", { ascending: false });

            if (branchId !== "all") {
                query = query.eq("branch_id", branchId);
            }

            const { data: visitsData, error: visitsError } = await query;

            if (visitsError) throw visitsError;

            // Set detailed visits for table
            setVisits(visitsData || []);

            const completedVisits = (visitsData || []).filter((v: any) => v.status === 'completed');

            let totalRevenue = 0;
            let totalProfitLoss = 0;
            let totalServicesCount = 0;

            completedVisits.forEach(visit => {
                const bill = (visit.bills as any)?.[0];
                if (bill) {
                    totalRevenue += Number(bill.total_branch_compensation);
                    totalProfitLoss += Number(bill.total_profit_loss);
                    totalServicesCount += 1;
                }
            });

            // New Members
            let membersQuery = supabase
                .from("members")
                .select('*', { count: 'exact', head: true })
                .gte("created_at", startOfMonthDate)
                .lte("created_at", endOfMonthDate);

            if (branchId !== "all") {
                membersQuery = membersQuery.eq("branch_id", branchId);
            }

            const { count: newMembersCount } = await membersQuery;

            // Appointments
            let apptsQuery = supabase
                .from("appointments" as any)
                .select("status")
                .gte("appointment_date", startOfMonthDate)
                .lte("appointment_date", endOfMonthDate);

            if (branchId !== "all") {
                apptsQuery = apptsQuery.eq("branch_id", branchId);
            }

            const { data: apptData } = await apptsQuery;

            const totalAppts = apptData?.length || 0;
            const completedAppts = apptData?.filter((a: any) => a.status === 'completed' || a.status === 'checked_in').length || 0;

            setStats({
                totalRevenue,
                visitCount: completedVisits.length,
                newMembers: newMembersCount || 0,
                profitLoss: totalProfitLoss,
                totalServices: totalServicesCount,
                totalAppts,
                completedAppts
            });

        } catch (error: any) {
            toast({ title: "Error fetching metrics", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Reports</h1>
                    <p className="text-muted-foreground">Aggregated performance metrics across all branches.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Branches" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Branches</SelectItem>
                            {branches.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /></div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Current Month</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Visits</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.visitCount}</div>
                            <p className="text-xs text-muted-foreground">Completed visits</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                KES {stats.profitLoss.toLocaleString()}
                            </div>
                            <p className="text-xs text-muted-foreground">Company-wide Margin</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Services</CardTitle>
                            <Stethoscope className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalServices}</div>
                            <p className="text-xs text-muted-foreground">Procedures performed</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {!loading && (
                <Card>
                    <CardHeader>
                        <CardTitle>Detailed Visit Reports</CardTitle>
                        <CardDescription>
                            Showing {visits.length} records for selected period.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Doctor</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visits.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No records found for this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visits.map((visit) => {
                                        const bill = visit.bills?.[0];
                                        return (
                                            <TableRow key={visit.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {format(new Date(visit.created_at), "yyyy-MM-dd HH:mm")}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{visit.members?.full_name || "Unknown"}</div>
                                                        <div className="text-xs text-muted-foreground">{visit.members?.member_number}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {visit.doctor?.full_name || "N/A"}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={bill?.service_name || "No Bill"}>
                                                    {bill?.service_name || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={visit.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                                                        {visit.status.replace('_', ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {bill?.total_branch_compensation ? `KES ${bill.total_branch_compensation.toLocaleString()}` : "-"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
