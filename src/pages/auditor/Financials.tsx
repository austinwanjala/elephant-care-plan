import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export default function AuditorFinancials() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("payments")
            .select("*, members(full_name)")
            .order("created_at", { ascending: false })
            .limit(20);

        if (data) setPayments(data);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Financial Overview</h1>
                <p className="text-muted-foreground">Payments, Revenue, and P&L Statements</p>
            </div>

            <Tabs defaultValue="payments">
                <TabsList>
                    <TabsTrigger value="payments">Member Payments</TabsTrigger>
                    <TabsTrigger value="branch_revenue">Branch Revenue</TabsTrigger>
                    <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Recent Member Payments</CardTitle></CardHeader>
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
                                    ) : payments.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell>{p.members?.full_name}</TableCell>
                                            <TableCell>KES {p.amount?.toLocaleString()}</TableCell>
                                            <TableCell>{p.status}</TableCell>
                                            <TableCell className="font-mono text-xs">{p.mpesa_reference}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="branch_revenue">
                    <Card><CardContent className="py-10 text-center text-muted-foreground">Select a branch to view revenue report.</CardContent></Card>
                </TabsContent>
                <TabsContent value="pnl">
                    <Card><CardContent className="py-10 text-center text-muted-foreground">Profit & Loss statement generation.</CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
