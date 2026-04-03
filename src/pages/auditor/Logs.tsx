import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Loader2, Activity, Download, ChevronLeft, ChevronRight,
    Search, RefreshCw, Eye, Shield, User, Clock, Filter
} from "lucide-react";
import { format } from "date-fns";
import { exportToCsv } from "@/utils/csvExport";

const PAGE_SIZE = 20;

const ACTION_COLORS: Record<string, string> = {
    login: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    logout: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    create: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    update: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    payment: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    verify: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

const getActionColor = (action: string): string => {
    const key = Object.keys(ACTION_COLORS).find(k => action?.toLowerCase().includes(k));
    return key ? ACTION_COLORS[key] : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
};

export default function AuditorLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterAction, setFilterAction] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = (supabase as any)
            .from("system_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (filterAction) query = query.ilike("action", `%${filterAction}%`);

        const { data: logsData, count, error } = await query;

        if (!error) {
            setLogs(logsData || []);
            if (count !== null) setTotalCount(count);
            if (logsData && logsData.length > 0) {
                await fetchUserNames(logsData);
            }
        }
        setLoading(false);
    }, [currentPage, filterAction]);

    const fetchUserNames = async (logsData: any[]) => {
        const userIds = Array.from(new Set(logsData.map((l: any) => l.user_id).filter((id: any) => id && id.length > 20)));
        if (userIds.length === 0) return;

        const [{ data: staffData }, { data: memberData }] = await Promise.all([
            supabase.from("staff").select("user_id, full_name").in("user_id", userIds),
            supabase.from("members").select("user_id, full_name").in("user_id", userIds),
        ]);

        const newMap: Record<string, string> = {};
        staffData?.forEach((s: any) => { if (s.user_id) newMap[s.user_id] = s.full_name; });
        memberData?.forEach((m: any) => { if (m.user_id) newMap[m.user_id] = m.full_name; });
        setUserMap(newMap);
    };

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleExport = () => {
        const dataToExport = logs.map(l => ({
            Timestamp: format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
            Action: l.action,
            User: userMap[l.user_id] || "System",
            UserID: l.user_id || "N/A",
            Details: JSON.stringify(l.details),
        }));
        exportToCsv("system_audit_logs.csv", dataToExport);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const filteredLogs = searchQuery
        ? logs.filter(l =>
            l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (userMap[l.user_id] || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            JSON.stringify(l.details).toLowerCase().includes(searchQuery.toLowerCase())
        )
        : logs;

    const statCounts = logs.reduce((acc: Record<string, number>, l: any) => {
        const key = Object.keys(ACTION_COLORS).find(k => l.action?.toLowerCase().includes(k)) || "other";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        System Audit Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Complete audit trail of all system actions with full traceability.
                        <span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-400">{totalCount.toLocaleString()} total records</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={fetchLogs} disabled={loading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button onClick={handleExport} disabled={loading || logs.length === 0}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: "Logins", key: "login", icon: User, color: "from-blue-500 to-blue-600" },
                    { label: "Creates", key: "create", icon: Shield, color: "from-emerald-500 to-teal-600" },
                    { label: "Updates", key: "update", icon: Activity, color: "from-amber-500 to-orange-600" },
                    { label: "Deletions", key: "delete", icon: Filter, color: "from-red-500 to-rose-600" },
                ].map(({ label, key, icon: Icon, color }) => (
                    <Card key={key} className="border-border/50 shadow-sm overflow-hidden">
                        <div className={`h-1 bg-gradient-to-r ${color}`} />
                        <CardContent className="pt-4 pb-3 flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                                <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{statCounts[key] || 0}</p>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-9 h-10 bg-white dark:bg-slate-900 border-border/60"
                        placeholder="Search by action, user, or details..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-9 h-10 w-full sm:w-48 bg-white dark:bg-slate-900 border-border/60"
                        placeholder="Filter by action..."
                        value={filterAction}
                        onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
                    />
                </div>
            </div>

            {/* Logs Grid */}
            <div className="space-y-4">
                <div className="flex flex-row items-center justify-between px-2 py-1">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
                        <Clock className="h-5 w-5 text-emerald-600" />
                        Recent Activity
                        <Badge variant="secondary" className="ml-2 text-xs font-bold">{filteredLogs.length} shown</Badge>
                    </h2>
                </div>
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 bg-white dark:bg-slate-900/30 rounded-xl border border-border/50 shadow-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-sm font-medium text-slate-500">Loading audit logs...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 bg-white dark:bg-slate-900/30 rounded-xl border border-border/50 shadow-sm">
                        <Activity className="h-8 w-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-500">No logs found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredLogs.map((log) => (
                            <Card key={log.id} className="border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white dark:bg-slate-900/50">
                                <div className="p-4 border-b border-border/50 bg-slate-50/80 dark:bg-slate-900/80 flex justify-between items-start gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-md">
                                            {(userMap[log.user_id] || "S").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                                {log.actor_name || userMap[log.user_id] || "System"}
                                            </p>
                                            <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                                {log.user_id || "N/A"}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm ${getActionColor(log.action)}`}>
                                        {log.action}
                                    </span>
                                </div>
                                <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 px-3 py-2 rounded-lg border border-border/40">
                                            <Clock className="h-4 w-4 text-emerald-500" />
                                            <span className="text-sm font-mono font-medium">
                                                {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-border/50 p-3 rounded-xl shadow-inner">
                                                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono line-clamp-3 leading-relaxed">
                                                    {JSON.stringify(log.details)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-border/50 mt-auto">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full gap-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 shadow-sm hover:shadow transition-all">
                                                    <Eye className="h-4 w-4" />
                                                    Inspect Details
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl">
                                                <DialogHeader>
                                                    <DialogTitle className="flex items-center gap-2 text-xl">
                                                        <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                            <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        Audit Log Details
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-5 py-2">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border/60 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50 shadow-sm">
                                                        <div>
                                                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Timestamp</span>
                                                            <span className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">{new Date(log.created_at).toLocaleString()}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5 overflow-hidden"><Activity className="h-3 w-3 inline mr-1.5" /> Action</span>
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${getActionColor(log.action)}`}>{log.action}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5"><User className="h-3 w-3 inline mr-1.5" /> User Name</span>
                                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{log.actor_name || userMap[log.user_id] || "System"}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5"><Shield className="h-3 w-3 inline mr-1.5" /> User ID</span>
                                                            <span className="font-mono text-[11px] bg-slate-200/50 dark:bg-slate-800 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-400 font-medium">{log.user_id || "N/A"}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 block mb-2 px-1">Full Event Data</span>
                                                        <div className="relative">
                                                            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-slate-950 to-transparent rounded-t-xl z-10 opacity-50 block"></div>
                                                            <pre className="bg-slate-950 text-emerald-400 p-5 rounded-2xl overflow-auto max-h-[50vh] text-xs font-mono leading-relaxed shadow-inner">
                                                                {JSON.stringify(log.details, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
                
                {/* Pagination */}
                <Card className="border-border/50 shadow-sm mt-6">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 font-medium">
                            Showing <span className="font-bold text-slate-700 dark:text-slate-300">{((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of <span className="font-bold text-slate-700 dark:text-slate-300">{totalCount.toLocaleString()}</span> logs
                        </p>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1 || loading}
                                className="h-9 px-4 gap-2 shadow-sm font-medium">
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <div className="flex items-center px-4 py-1.5 bg-slate-100 dark:bg-slate-800 border border-border/60 rounded-lg text-sm font-bold shadow-inner">
                                {currentPage} <span className="text-slate-400 mx-1">/</span> {totalPages || 1}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || loading}
                                className="h-9 px-4 gap-2 shadow-sm font-medium">
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
