import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Settings, History, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminWhatsApp() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [config, setConfig] = useState({
        enabled: true,
        phoneId: "",
        businessId: "",
    });
    const [testMessage, setTestMessage] = useState({
        phone: "",
        template: "member_welcome",
    });
    const { toast } = useToast();

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("whatsapp_logs")
            .select(`
        *,
        members(full_name)
      `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (data) setLogs(data);
        setLoading(false);
    };

    const handleSendTest = async () => {
        if (!testMessage.phone) {
            toast({ title: "Phone number required", variant: "destructive" });
            return;
        }
        setSending(true);
        try {
            const { data, error } = await supabase.functions.invoke("send-whatsapp", {
                body: {
                    phone: testMessage.phone,
                    template: testMessage.template,
                    data: { name: "Test User" }
                }
            });

            if (error) throw error;
            toast({ title: "Test message queued", description: "Check logs for status updates." });
            loadLogs();
        } catch (error: any) {
            toast({ title: "Send failed", description: error.message, variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'read': return <Badge className="bg-blue-500">Read</Badge>;
            case 'delivered': return <Badge className="bg-success">Delivered</Badge>;
            case 'sent': return <Badge variant="secondary">Sent</Badge>;
            case 'failed': return <Badge variant="destructive">Failed</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-serif font-bold">WhatsApp Configuration</h1>
                    <p className="text-muted-foreground">Manage Cloud API settings and message logs</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={config.enabled ? "default" : "secondary"}>
                        {config.enabled ? "Service Active" : "Service Paused"}
                    </Badge>
                    <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Settings className="h-5 w-5" /> Test Utility
                        </CardTitle>
                        <CardDescription>Send a manual template message</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Phone Number (E.164)</Label>
                            <Input
                                placeholder="+254..."
                                value={testMessage.phone}
                                onChange={e => setTestMessage({ ...testMessage, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Template</Label>
                            <Input value={testMessage.template} disabled />
                        </div>
                        <Button
                            className="w-full btn-primary"
                            onClick={handleSendTest}
                            disabled={sending}
                        >
                            {sending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <><Send className="mr-2 h-4 w-4" /> Send Test Message</>}
                        </Button>
                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Webhook Status</span>
                                <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Configured</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" /> Delivery Logs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Member</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
                                    ) : logs.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No logs found.</TableCell></TableRow>
                                    ) : logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs">{format(new Date(log.created_at), "MMM d, HH:mm")}</TableCell>
                                            <TableCell>{log.members?.full_name || log.phone}</TableCell>
                                            <TableCell className="text-xs font-mono">{log.type}</TableCell>
                                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
