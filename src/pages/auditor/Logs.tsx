import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, History, User } from "lucide-react";
import { format } from "date-fns";

export default function AuditorLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userMap, setUserMap] = useState<Record<string, string>>({});

    const fetchLogs = async () => {
        setLoading(true);
        const { data: logsData, error } = await (supabase as any)
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) {
            console.error("Error fetching logs:", error);
        } else {
            setLogs(logsData || []);
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

        staffData?.forEach(s => {
            if (s.user_id) newMap[s.user_id] = s.full_name;
        });

        memberData?.forEach(m => {
            if (m.user_id) newMap[m.user_id] = m.full_name;
        });

        setUserMap(newMap);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                <p className="text-muted-foreground">Audit trail of system actions with user traceability</p>
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
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No logs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                            {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium bg-secondary/30 rounded px-2 py-1 text-[10px] uppercase tracking-wider">
                                                {log.action}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {log.user_id ? (
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm flex items-center gap-1">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        {userMap[log.user_id] || "Unknown User"}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                                                        {log.user_id}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic text-sm">System</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                                            {JSON.stringify(log.details)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="sm">View</Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Audit Log Details</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md bg-muted/20">
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground text-xs uppercase">Timestamp</span>
                                                                {new Date(log.created_at).toLocaleString()}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground text-xs uppercase">Action</span>
                                                                {log.action}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground text-xs uppercase">User Name</span>
                                                                {userMap[log.user_id] || 'N/A'}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground text-xs uppercase">User ID</span>
                                                                <span className="font-mono text-xs">{log.user_id || 'System'}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-2 text-sm">Metadata:</h4>
                                                            <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto text-xs font-mono">
                                                                {JSON.stringify(log.details, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}