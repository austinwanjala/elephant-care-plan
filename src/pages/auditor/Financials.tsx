import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Building2, DollarSign, Download, ChevronLeft, ChevronRight, User, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/utils/csvExport";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PAGE_SIZE = 10;

export default function AuditorFinancials() {
    const [payments, setPayments] = useState<any[]>([]);
    const [marketerClaims, setMarketerClaims] = useState<any[]>([]);
    const [revenueClaims, setRevenueClaims] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [activeTab, setActiveTab] = useState("payments");

    useEffect(() => {
        fetchData();
    }, [activeTab, currentPage]);

    const fetchData = async () => {
        setLoading(true);
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        try {
            if (activeTab === "payments") {
                const { data, count } = await supabase
                    .from("payments")
                    .select("*, members(full_name)", { count: "exact" })
                    .order("created_at", { ascending: false })
                    .range(from, to);
                setPayments(data || []);
                setTotalCount(count || 0);
            } else if (activeTab === "marketer_payouts") {
                const { data, count } = await (supabase as any)
                    .from("marketer_claims")
                    .select("*, marketers(full_name, code), staff:paid_by(full_name)", { count: "exact" })
                    .order("created_at", { ascending: false })
                    .range(from, to);
                setMarketerClaims(data || []);
                setTotalCount(count || 0);
            } else if (activeTab === "branch_payouts") {
                const { data, count } = await (supabase as any)
                    .from("revenue_claims")
                    .select("*, branches(name), staff:paid_by(full_name), director:director_id(full_name)", { count: "exact" })
                    .order("created_at", { ascending: false })
                    .range(from, to);
                setRevenueClaims(data || []);
                setTotalCount(count || 0);
            } else if (activeTab === "pnl") {
                const { data: branchData } = await supabase.from("branches").select("id, name");
                if (branchData) {
                    const { data: revenueData } = await supabase
                        .from("branch_revenue")
                        .select("branch_id, total_compensation, total_profit_loss");

                    const enhancedBranches = branchData.map(b => {
                        const branchRevenues = revenueData?.filter(r => r.branch_id === b.id) || [];
                        const totalComp = branchRevenues.reduce((sum, r) => sum + (r.total_compensation || 0), 0);
                        const totalPL = branchRevenues.reduce((sum, r) => sum + (r.total_profit_loss || 0), 0);
                        return { ...b, total_compensation: totalComp, total_profit_loss: totalPL, total_revenue: totalComp + totalPL };
                    });
                    setBranches(enhancedBranches);
                }
            }
        } catch (error) {
            console.error("Error fetching financials:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        let dataToExport = [];
        let filename = "audit_report.csv";

        if (activeTab === "payments") {
            dataToExport = payments.map(p => ({
                Date: format(new Date(p.created_at), "yyyy-MM-dd HH:mm"),
                Member: p.members?.full_name,
                Amount: p.amount,
                Status: p.status,
                Reference: p.mpesa_reference
            }));
            filename = "member_payments_report.csv";
        } else if (activeTab === "marketer_payouts") {
            dataToExport = marketerClaims.map(c => ({
                Date: format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
                Marketer: c.marketers?.full_name,
                Amount: c.amount,
                Status: c.status,
                PaidBy: c.staff?.full_name || "N/A",
                PaidAt: c.paid_at ? format(new Date(c.paid_at), "yyyy-MM-dd") : "N/A"
            }));
            filename = "marketer_payouts_report.csv";
        } else if (activeTab === "branch_payouts") {
            dataToExport = revenueClaims.map(c => ({
                Date: format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
                Branch: c.branches?.name,
                Director: c.director?.full_name,
                Amount: c.amount,
                Status: c.status,
                PaidBy: c.staff?.full_name || "N/A"
            }));
            filename = "branch_payouts_report.csv";
        }

        exportToCsv(filename, dataToExport);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Audit</h1>
                    <p className="text-muted-foreground">Comprehensive tracking of all system cash flows</p>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={loading || activeTab === "pnl"}>
                    <Download className="mr-2 h-4 w-4" /> Export Report
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
                <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                    <TabsTrigger value="payments">Member Payments</TabsTrigger>
                    <TabsTrigger value="marketer_payouts">Marketer Payouts</TabsTrigger>
                    <TabsTrigger value="branch_payouts">Branch Payouts</TabsTrigger>
                    <TabsTrigger value="pnl">P&L Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Member Contributions</CardTitle></CardHeader>
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
                                    ) : (
                                        payments.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell className="text-xs">{format(new Date(p.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                                                <TableCell className="font-medium">{p.members?.full_name}</TableCell>
                                                <TableCell>KES {p.amount?.toLocaleString()}</TableCell>
                                                <TableCell><Badge variant={p.status === 'completed' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                                                <TableCell className="font-mono text-xs">{p.mpesa_reference}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="marketer_payouts" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Marketer Commission Payouts</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Marketer</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Paid By (Finance)</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : (
                                        marketerClaims.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className="text-xs">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{c.marketers?.full_name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{c.marketers?.code}</div>
                                                </TableCell>
                                                <TableCell className="font-bold">KES {c.amount?.toLocaleString()}</TableCell>
                                                <TableCell><Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                                                <TableCell>
                                                    {c.staff?.full_name ? (
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <User className="h-3 w-3" /> {c.staff.full_name}
                                                        </div>
                                                    ) : "Pending"}
                                                </TableCell>
                                                <TableCell>
                                                    <Dialog>
                                                        <DialogTrigger asChild><Button variant="ghost" size="icon"><Info className="h-4 w-4" /></Button></DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader><DialogTitle>Payout Metadata</DialogTitle></DialogHeader>
                                                            <div className="space-y-2 text-sm">
                                                                <div className="grid grid-cols-2 border-b py-1"><span>Claim ID:</span><span className="font-mono text-xs">{c.id}</span></div>
                                                                <div className="grid grid-cols-2 border-b py-1"><span>Referrals:</span><span>{c.referral_count}</span></div>
                                                                <div className="grid grid-cols-2 border-b py-1"><span>Paid At:</span><span>{c.paid_at ? format(new Date(c.paid_at), "PPP") : "N/A"}</span></div>
                                                                <div className="grid grid-cols-2 border-b py-1"><span>Finance ID:</span><span className="font-mono text-xs">{c.paid_by || "N/A"}</span></div>
                                                                <div className="pt-2"><span className="font-bold block mb-1">Notes:</span><p className="p-2 bg-muted rounded italic">{c.notes || "No notes provided"}</p></div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="branch_payouts" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Branch Revenue Payouts</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Branch</TableHead>
                                        <TableHead>Director</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Paid By (Finance)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : (
                                        revenueClaims.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className="text-xs">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                                                <TableCell className="font-medium">{c.branches?.name}</TableCell>
                                                <TableCell className="text-xs">{c.director?.full_name}</TableCell>
                                                <TableCell className="font-bold">KES {c.amount?.toLocaleString()}</TableCell>
                                                <TableCell><Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                                                <TableCell className="text-xs">{c.staff?.full_name || "Pending"}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pnl" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Profit & Loss Overview</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3 mb-6">
                                <div className="p-6 border rounded-lg bg-green-50">
                                    <h3 className="text-sm font-medium text-green-800">Total Revenue</h3>
                                    <p className="text-2xl font-bold text-green-900 mt-2">KES {branches.reduce((acc, b) => acc + (b.total_revenue || 0), 0).toLocaleString()}</p>
                                </div>
                                <div className="p-6 border rounded-lg bg-red-50">
                                    <h3 className="text-sm font-medium text-red-800">Total Compensation</h3>
                                    <p className="text-2xl font-bold text-red-900 mt-2">KES {branches.reduce((acc, b) => acc + (b.total_compensation || 0), 0).toLocaleString()}</p>
                                </div>
                                <div className="p-6 border rounded-lg bg-slate-50">
                                    <h3 className="text-sm font-medium text-slate-800">Net Profit</h3>
                                    <p className="text-2xl font-bold text-slate-900 mt-2">KES {branches.reduce((acc, b) => acc + (b.total_profit_loss || 0), 0).toLocaleString()}</p>
                                </div>
                            </div>
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
                                            <TableCell className="text-right">KES {b.total_revenue?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">KES {b.total_compensation?.toLocaleString()}</TableCell>
                                            <TableCell className={`text-right font-bold ${b.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>KES {b.total_profit_loss?.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function PaginationControls({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
    );
}