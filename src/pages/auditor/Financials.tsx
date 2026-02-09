import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuditorFinancials() {
    const [payments, setPayments] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedRevenue, setSelectedRevenue] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [revenueLoading, setRevenueLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'failed' | 'completed'>('all');

    useEffect(() => {
        fetchData();
    }, [filterStatus]); // Re-fetch when filter changes

    const fetchBranches = async () => {
        // Fetch branches and their revenue aggregates
        const { data: branchData } = await supabase.from("branches").select("id, name");

        if (branchData) {
            // Fetch revenue stats for all branches
            const { data: revenueData } = await supabase
                .from("branch_revenue")
                .select("branch_id, total_compensation, total_profit_loss");

            // Aggregate
            const enhancedBranches = branchData.map(b => {
                const branchRevenues = revenueData?.filter(r => r.branch_id === b.id) || [];
                const totalComp = branchRevenues.reduce((sum, r) => sum + (r.total_compensation || 0), 0);
                const totalPL = branchRevenues.reduce((sum, r) => sum + (r.total_profit_loss || 0), 0);
                // Assuming Revenue = Comp + PL (simplified logic for estimation)
                // Or if we have a direct revenue field. Let's use PL + Comp for now as 'Revenue' generated
                const totalRev = totalComp + totalPL;

                return {
                    ...b,
                    total_compensation: totalComp,
                    total_profit_loss: totalPL,
                    total_revenue: totalRev
                };
            });

            setBranches(enhancedBranches);
        }
    };

    const fetchBranchRevenue = async (branchId: string) => {
        setRevenueLoading(true);
        setSelectedRevenue([]); // Reset while loading
        const { data } = await supabase
            .from("branch_revenue")
            .select("*")
            .eq("branch_id", branchId)
            .order("date", { ascending: false });

        if (data) setSelectedRevenue(data);
        setRevenueLoading(false);
    };

    const fetchData = async () => {
        setLoading(true);
        let query = supabase
            .from("payments")
            .select("*, members(full_name)")
            .order("created_at", { ascending: false })
            .limit(20);

        if (filterStatus !== 'all') {
            query = query.eq('status', filterStatus);
        }

        const { data } = await query;
        if (data) setPayments(data);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Financial Overview</h1>
                <p className="text-muted-foreground">Payments, Revenue, and P&L Statements</p>
            </div>

            <Tabs defaultValue="payments">
                <TabsList>
                    <TabsTrigger value="payments">Member Payments</TabsTrigger>
                    <TabsTrigger value="branch_revenue">Branch Revenue</TabsTrigger>
                    <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Member Payments</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant={filterStatus === 'all' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilterStatus('all')}
                                >
                                    All
                                </Button>
                                <Button
                                    variant={filterStatus === 'failed' ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => setFilterStatus('failed')}
                                >
                                    Failed
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Member</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Reference</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : payments.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No records found.</TableCell></TableRow>
                                    ) : (
                                        payments.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell>{p.members?.full_name}</TableCell>
                                                <TableCell>KES {p.amount?.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${p.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                        p.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{p.mpesa_reference}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="branch_revenue" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Branch Revenue Reports</CardTitle>
                            <div className="w-[250px]">
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    onChange={(e) => fetchBranchRevenue(e.target.value)}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select a Branch</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!selectedRevenue ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    Please select a branch to view its revenue report.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Visits</TableHead>
                                            <TableHead className="text-right">Total Compensation</TableHead>
                                            <TableHead className="text-right">Profit/Loss</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {revenueLoading ? (
                                            <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                        ) : selectedRevenue.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No revenue records found for this branch.</TableCell></TableRow>
                                        ) : (
                                            selectedRevenue.map(r => (
                                                <TableRow key={r.id}>
                                                    <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">{r.visit_count}</TableCell>
                                                    <TableCell className="text-right">KES {r.total_compensation?.toLocaleString()}</TableCell>
                                                    <TableCell className={`text-right ${r.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        KES {r.total_profit_loss?.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="pnl" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profit & Loss Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="p-6 border rounded-lg bg-green-50">
                                    <h3 className="text-sm font-medium text-green-800">Total Revenue</h3>
                                    <p className="text-2xl font-bold text-green-900 mt-2">
                                        KES {branches.reduce((acc, b) => acc + (b.total_revenue || 0), 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-green-700 mt-1">Aggregated from all branches</p>
                                </div>
                                <div className="p-6 border rounded-lg bg-red-50">
                                    <h3 className="text-sm font-medium text-red-800">Total Compensation</h3>
                                    <p className="text-2xl font-bold text-red-900 mt-2">
                                        KES {branches.reduce((acc, b) => acc + (b.total_compensation || 0), 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-red-700 mt-1">Paid to branches</p>
                                </div>
                                <div className="p-6 border rounded-lg bg-slate-50">
                                    <h3 className="text-sm font-medium text-slate-800">Net Profit / Loss</h3>
                                    <p className="text-2xl font-bold text-slate-900 mt-2">
                                        KES {branches.reduce((acc, b) => acc + (b.total_revenue || 0) - (b.total_compensation || 0), 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-700 mt-1">Revenue - Compensation</p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h3 className="text-lg font-semibold mb-4">Branch Performance Breakdown</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Branch</TableHead>
                                            <TableHead className="text-right">Revenue</TableHead>
                                            <TableHead className="text-right">Compensation</TableHead>
                                            <TableHead className="text-right">Net P&L</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {branches.map(b => (
                                            <TableRow key={b.id}>
                                                <TableCell className="font-medium">{b.name}</TableCell>
                                                <TableCell className="text-right">KES {(b.total_revenue || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-right">KES {(b.total_compensation || 0).toLocaleString()}</TableCell>
                                                <TableCell className={`text-right font-bold ${(b.total_revenue - b.total_compensation) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    KES {((b.total_revenue || 0) - (b.total_compensation || 0)).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
