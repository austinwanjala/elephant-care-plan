import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export default function AuditorLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userMap, setUserMap] = useState<Record<string, string>>({});

    const fetchLogs = async () => {
        setLoading(true);
        // Fetch logs from 'audit_logs'
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
        const userIds = Array.from(new Set(logsData.map(l => l.user_id).filter(id => id && id.length > 20))); // Filter valid UUIDs
        if (userIds.length === 0) return;

        const { data: staffData } = await supabase.from("staff").select("user_id, full_name, role").in("user_id", userIds);
        const { data: memberData } = await supabase.from("members").select("user_id, full_name").in("user_id", userIds);

        const newMap: Record<string, string> = {};

        staffData?.forEach(s => {
            if (s.user_id) newMap[s.user_id] = `${s.full_name} (${s.role || 'Staff'})`;
        });

        memberData?.forEach(m => {
            if (m.user_id) newMap[m.user_id] = `${m.full_name} (Member)`;
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
                <p className="text-muted-foreground">Audit trail of system actions</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>User / Actor</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>View</TableHead>
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
                                        No logs found or table not accessible.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                            {new Date(log.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="font-medium bg-secondary/20 rounded px-2 py-1 inline-block text-xs">
                                            {log.action}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {log.user_id ? (
                                                <span className={userMap[log.user_id] ? "font-semibold text-primary" : "font-mono text-xs text-muted-foreground"}>
                                                    {userMap[log.user_id] || log.user_id}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground italic">System</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                            {JSON.stringify(log.details)}
                                        </TableCell>
                                        <TableCell>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open details</span>
                                                        Details
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Audit Log Details</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md">
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground">Timestamp</span>
                                                                {new Date(log.created_at).toLocaleString()}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground">Action</span>
                                                                {log.action}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground">User</span>
                                                                {userMap[log.user_id || ''] || log.user_id || 'System'}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold block text-muted-foreground">Log ID</span>
                                                                <span className="font-mono text-xs">{log.id}</span>
                                                            </div>
                                                            {log.entity_type && (
                                                                <div>
                                                                    <span className="font-semibold block text-muted-foreground">Entity Type</span>
                                                                    {log.entity_type}
                                                                </div>
                                                            )}
                                                            {log.entity_id && (
                                                                <div>
                                                                    <span className="font-semibold block text-muted-foreground">Entity ID</span>
                                                                    <span className="font-mono text-xs">{log.entity_id}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-2">Raw Metadata:</h4>
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
