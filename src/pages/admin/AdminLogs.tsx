import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function AdminLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("system_logs")
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

    // Debugging Tool: Simulate M-Pesa Callback
    const handleSimulateCallback = async () => {
        const checkoutId = `TEST-${Date.now()}`;
        const amount = 100;

        // 1. Create a dummy pending record
        // We need a valid member_id. Let's try to get one from the logs or just any member.
        // Actually, for a test, we might fail foreign key constraint if we don't use a valid member.
        // Let's try to fetch one member first.
        const { data: member } = await supabase.from('members').select('id').limit(1).maybeSingle();

        if (!member) {
            alert("Cannot simulate: No members found to attach payment to.");
            return;
        }

        const { error: insertError } = await supabase.from("payments").insert({
            member_id: member.id,
            amount: amount,
            coverage_added: amount,
            mpesa_checkout_request_id: checkoutId,
            status: 'pending',
            phone_used: '254700000000'
        });

        if (insertError) {
            console.error("Test setup failed:", insertError);
            alert("Failed to create test payment record.");
            return;
        }

        // 2. Invoke Callback
        const payload = {
            Body: {
                stkCallback: {
                    MerchantRequestID: `MR-${checkoutId}`,
                    CheckoutRequestID: checkoutId,
                    ResultCode: 0,
                    ResultDesc: "The service request is processed successfully.",
                    Amount: amount,
                    MpesaReceiptNumber: `RC-${checkoutId}`,
                    Balance: 0,
                    TransactionDate: format(new Date(), "yyyyMMddHHmmss"),
                    PhoneNumber: 254700000000,
                    CallbackMetadata: {
                        Item: [
                            { Name: "Amount", Value: amount },
                            { Name: "MpesaReceiptNumber", Value: `RC-${checkoutId}` },
                            { Name: "TransactionDate", Value: format(new Date(), "yyyyMMddHHmmss") },
                            { Name: "PhoneNumber", Value: 254700000000 }
                        ]
                    }
                }
            }
        };

        const { error: invokeError } = await supabase.functions.invoke('mpesa-callback', {
            body: payload
        });

        if (invokeError) {
            alert(`Simulation failed: ${invokeError.message}`);
        } else {
            alert("Simulation sent! Check the logs table for 'MPESA_CALLBACK_SUCCESS'.");
            fetchLogs();
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
                <Button variant="outline" onClick={handleSimulateCallback}>
                    <Filter className="mr-2 h-4 w-4" /> Simulate M-Pesa Callback
                </Button>
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
                            {loading ? (
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
        </div>
    );
}
