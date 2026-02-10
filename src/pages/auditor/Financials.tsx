import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, ChevronLeft, ChevronRight, User, Info, AlertCircle } from "lucide-react";
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
                // Improved query for branch payouts
                const { data, count, error } = await (supabase as any)
                    .from("revenue_claims")
                    .select(`
                        *,
                        branches:branch_id(name),
                        staff:paid_by(full_name),
                        director:director_id(full_name)
                    `, { count: "exact" })
                    .order("created_at", { ascending: false })
                    .range(from, to);
                
                if (error) console.error("Error fetching branch payouts:", error);
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
            console.error("Error in fetchData:", error);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Audit</h1>
                    <p className="text-muted-foreground">Comprehensive tracking of all system cash flows</p>
                </div>
                <Button variant="outline" disabled={loading || activeTab === "pnl"}>
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
                                    ) : revenueClaims.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle className="h-8 w-8 opacity-20" />
                                                    <p>No branch payout records found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        revenueClaims.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className="text-xs">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                                                <TableCell className="font-medium">{c.branches?.name || 'Unknown Branch'}</TableCell>
                                                <TableCell className="text-xs">{c.director?.full_name || 'N/A'}</TableCell>
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

                {/* Other TabsContent (payments, marketer_payouts, pnl) remain as previously implemented */}
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