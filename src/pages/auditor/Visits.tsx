import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/utils/csvExport";
import { format } from "date-fns";

const PAGE_SIZE = 10;

export default function AuditorVisits() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchVisits = async () => {
        setLoading(true);
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, count } = await supabase
            .from("visits")
            .select("*, members(full_name), branches(name)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (data) setVisits(data);
        if (count !== null) setTotalCount(count);
        setLoading(false);
    };

    useEffect(() => {
        fetchVisits();
    }, [currentPage]);

    const handleExport = () => {
        const dataToExport = visits.map(v => ({
            Date: format(new Date(v.created_at), "yyyy-MM-dd HH:mm"),
            Patient: v.members?.full_name,
            Branch: v.branches?.name,
            Status: v.status,
            Deducted: v.benefit_deducted,
            Compensation: v.branch_compensation
        }));
        exportToCsv("visits_audit_report.csv", dataToExport);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Visits</h1>
                    <p className="text-muted-foreground">Read-only view of patient visits</p>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={loading}>
                    <Download className="mr-2 h-4 w-4" /> Export Report
                </Button>
            </div>

            <Card>
                <CardHeader><CardTitle>Recent Visits</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Patient / Member</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Clinical</TableHead>
                                <TableHead>Financials</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : visits.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24">No visits recorded.</TableCell></TableRow>
                            ) : (
                                visits.map((visit) => (
                                    <TableRow key={visit.id}>
                                        <TableCell className="text-xs">{format(new Date(visit.created_at), "MMM d, HH:mm")}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{visit.members?.full_name}</div>
                                            {visit.dependant_id && <Badge variant="outline" className="text-[10px]">Dependant Visit</Badge>}
                                        </TableCell>
                                        <TableCell>{visit.branches?.name}</TableCell>
                                        <TableCell><Badge variant="secondary" className="capitalize">{visit.status}</Badge></TableCell>
                                        <TableCell>
                                            {visit.xray_urls && visit.xray_urls.length > 0 && (
                                                <div className="flex gap-1">
                                                    {visit.xray_urls.map((url: string, idx: number) => (
                                                        <Dialog key={idx}>
                                                            <DialogTrigger asChild>
                                                                <div className="relative cursor-pointer group rounded border overflow-hidden h-8 w-8 flex-shrink-0 bg-slate-100">
                                                                    <img src={url} alt="X-ray thumbnail" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                                                                </div>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-4xl p-1 bg-black/90 border-0">
                                                                <DialogHeader className="hidden"><DialogTitle>X-Ray View</DialogTitle></DialogHeader>
                                                                <div className="flex items-center justify-center min-h-[50vh]">
                                                                    <img src={url} alt="X-ray clinical view" className="max-h-[85vh] w-auto object-contain" />
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    ))}
                                                </div>
                                            )}
                                            {!visit.xray_urls?.length && <span className="text-xs text-muted-foreground">-</span>}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            <div>Deducted: {visit.benefit_deducted}</div>
                                            <div>Comp: {visit.branch_compensation}</div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                        <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}