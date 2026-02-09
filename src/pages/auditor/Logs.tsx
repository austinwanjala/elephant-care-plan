import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, History, User, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { exportToCsv } from "@/utils/csvExport";

const PAGE_SIZE = 15;

export default function AuditorLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchLogs = async () => {
        setLoading(true);
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: logsData, count, error } = await (supabase as any)
            .from("audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            console.error("Error fetching logs:", error);
        } else {
            setLogs(logsData || []);
            if (count !== null) setTotalCount(count);
            if (logsData && logsData.length > 0) {
                await fetchUserNames(logsData);
            }
        }
        setLoading(false);
    };

    const fetchUserNames = async (logsData: any[]) => {
        const userIds = Array.from(new Set(logsData.map(l => l.user_id).filter(id => id && id.length > 20)));
        if (userIds.length === 0) return;

        const [{ data: staffData }, { data: memberData }] = await Promise.all([
            supabase.from("staff").select("user_id, full_name").in("user_id", userIds),
            supabase.from("members").select("user_id, full_name").in("user_id", userIds)
        ]);

        const newMap: Record<string, string> = {};
        staffData?.forEach(s => { if (s.user_id) newMap[s.user_id] = s.full_name; });
        memberData?.forEach(m => { if (m.user_id) newMap[m.user_id] = m.full_name; });
        setUserMap(newMap);
    };

    useEffect(() => {
        fetchLogs();
    }, [currentPage]);

    const handleExport = () => {
        const dataToExport = logs.map(l => ({
            Timestamp: format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
            Action: l.action,
            User: userMap[l.user_id] || "System",
            UserID: l.user_id || "N/A",
            Details: JSON.stringify(l.details)
        }));
        exportToCsv("system_audit_logs.csv", dataToExport);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground">Audit trail of system actions with user traceability</p>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={loading}>
                    <Download className="mr-2 h-4 w-4" /> Export Report
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Recent Activity</CardTitle>
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh Logs"}
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>User / Actor</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24">No logs found.</TableCell></TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">{format(new Date(log.created_at), "MMM d, HH:mm:ss")}</TableCell>
                                        <TableCell><span className="font-medium bg-secondary/30 rounded px-2 py-1 text-[10px] uppercase tracking-wider">{log.action}</span></TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-xs">{userMap[log.user_id] || "System"}</span>
                                                <span className="text-[9px] font-mono text-muted-foreground truncate max-w-[100px]">{log.user_id || ""}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-[10px] text-muted-foreground">{JSON.stringify(log.details)}</TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild><Button variant="ghost" size="sm">View</Button></DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader><DialogTitle>Audit Log Details</DialogTitle></DialogHeader>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md bg-muted/20">
                                                            <div><span className="font-semibold block text-muted-foreground text-xs uppercase">Timestamp</span>{new Date(log.created_at).toLocaleString()}</div>
                                                            <div><span className="font-semibold block text-muted-foreground text-xs uppercase">Action</span>{log.action}</div>
                                                            <div><span className="font-semibold block text-muted-foreground text-xs uppercase">User Name</span>{userMap[log.user_id] || 'System'}</div>
                                                            <div><span className="font-semibold block text-muted-foreground text-xs uppercase">User ID</span><span className="font-mono text-xs">{log.user_id || 'N/A'}</span></div>
                                                        </div>
                                                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto text-xs font-mono">{JSON.stringify(log.details, null, 2)}</pre>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <div className="flex items-center justify-end space-x-2 py-4 px-4">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                        <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}