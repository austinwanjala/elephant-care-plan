import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Loader2, RefreshCw, Eye } from "lucide-react";
import { exportToCsv } from "@/utils/csvExport";
import { kopokopoService } from "@/services/kopokopo";

interface Payment {
    id: string;
    member_id: string;
    amount: number;
    status: string;
    kopo_resource_id: string | null;
    phone_used: string | null;
    reference: string | null;
    mpesa_code: string | null;
    payment_date: string | null;
    created_at: string;
    members: {
        full_name: string;
        phone: string;
    } | null;
    kopokopo_metadata: any;
}

export default function AdminPayments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const { toast } = useToast();

    useEffect(() => {
        fetchPayments();
    }, [statusFilter]);

    const fetchPayments = async () => {
        setLoading(true);
        let query = supabase
            .from("payments")
            .select("*, members(full_name, phone)")
            .order("created_at", { ascending: false });

        if (statusFilter !== "all") {
            query = query.eq("status", statusFilter as any);
        }

        const { data, error } = await query;

        if (error) {
            toast({ title: "Error fetching payments", description: error.message, variant: "destructive" });
        } else {
            setPayments(data as any);
        }
        setLoading(false);
    };

    const handleVerifyStatus = async (resourceId: string) => {
        try {
            const data = await kopokopoService.checkStatus(resourceId);
            toast({
                title: "Status Verified",
                description: `Current status: ${data.data.status || 'Unknown'}`
            });
            fetchPayments();
        } catch (error: any) {
            toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
        }
    };

    const filteredPayments = payments.filter((p) =>
        p.members?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone_used?.includes(searchTerm) ||
        p.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.mpesa_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.kopo_resource_id?.includes(searchTerm)
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <Badge className="bg-green-500">Success</Badge>;
            case "pending":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
            case "failed":
                return <Badge variant="destructive">Failed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-serif font-bold">Payments & Transactions</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => exportToCsv("payments.csv", filteredPayments)}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    <Button variant="outline" onClick={fetchPayments} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by member, phone, or reference..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Success</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="card-elevated overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Member</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Mpesa Code</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8">
                                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : filteredPayments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    No payments found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPayments.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell>{new Date(payment.created_at).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{payment.members?.full_name || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground">{payment.kopokopo_metadata?.payment_type || 'Payment'}</div>
                                    </TableCell>
                                    <TableCell>{payment.phone_used}</TableCell>
                                    <TableCell className="font-bold">KES {payment.amount.toLocaleString()}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-green-700">
                                        {payment.mpesa_code ||
                                            payment.kopokopo_metadata?.data?.attributes?.reference ||
                                            payment.kopokopo_metadata?.data?.attributes?.mpesa_reference ||
                                            '-'}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{payment.reference || payment.kopo_resource_id || '-'}</TableCell>
                                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                                    <TableCell>
                                        {payment.kopo_resource_id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleVerifyStatus(payment.kopo_resource_id!)}
                                                title="Verify status with KopoKopo"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
