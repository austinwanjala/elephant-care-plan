import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Filter, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) {
            console.error("Error fetching logs:", error);
        } else {
            setLogs(data || []);
        }
        setLoading(false);
    };

    const handleSimulateCallback = async () => {
        // 1. Find the most recent pending payment
        const { data: pendingPayment } = await supabase
            .from('payments')
            .select('mpesa_checkout_request_id, amount, phone_used')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!pendingPayment || !pendingPayment.mpesa_checkout_request_id) {
            toast({
                title: "No Pending Payments",
                description: "Please initiate a payment from a member account first.",
                variant: "destructive"
            });
            return;
        }

        const checkoutId = pendingPayment.mpesa_checkout_request_id;
        const receipt = `RC${Math.floor(Math.random() * 1000000000)}`;

        const payload = {
            Body: {
                stkCallback: {
                    MerchantRequestID: `MR-${checkoutId}`,
                    CheckoutRequestID: checkoutId,
                    ResultCode: 0,
                    ResultDesc: "The service request is processed successfully.",
                    CallbackMetadata: {
                        Item: [
                            { Name: "Amount", Value: pendingPayment.amount },
                            { Name: "MpesaReceiptNumber", Value: receipt },
                            { Name: "TransactionDate", Value: format(new Date(), "yyyyMMddHHmmss") },
                            { Name: "PhoneNumber", Value: pendingPayment.phone_used }
                        ]
                    }
                }
            }
        };

        toast({ title: "Simulating...", description: `Processing ID: ${checkoutId}` });

        try {
            const { data, error: invokeError } = await supabase.functions.invoke('mpesa-callback', {
                body: payload
            });

            if (invokeError) {
                // Try to parse the error from the function response
                const errorData = await invokeError.context?.json().catch(() => ({}));
                throw new Error(errorData?.error || invokeError.message);
            }

            toast({ title: "Success!", description: "Payment verified and database updated." });
            setTimeout(fetchLogs, 1000);
        } catch (err: any) {
            toast({ title: "Simulation Failed", description: err.message, variant: "destructive" });
        }
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground">Audit trail of system activities and data changes.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search logs..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Displaying last 100 logs.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>User ID</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No logs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono">
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[150px] truncate" title={log.user_id}>
                                            {log.user_id || "System"}
                                        </TableCell>
                                        <TableCell className="max-w-[400px]">
                                            <pre className="text-[10px] bg-slate-50 p-2 rounded overflow-auto max-h-[100px]">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div >
    );
}