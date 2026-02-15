import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Inbox, SendHorizontal, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function AdminNotifications() {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Form State
    const [targetType, setTargetType] = useState<"broadcast" | "role" | "user">("role");
    const [selectedRole, setSelectedRole] = useState<string>("all");
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");

    // Lists State
    const [inbox, setInbox] = useState<any[]>([]);
    const [sent, setSent] = useState<any[]>([]);
    const [loadingLists, setLoadingLists] = useState(false);

    useEffect(() => {
        fetchMessages();
    }, []);

    const fetchMessages = async () => {
        setLoadingLists(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Inbox using RPC
        const { data: inboxData, error: inboxError } = await supabase
            .rpc("get_admin_notifications", { p_user_id: user.id });

        if (inboxError) {
            console.error("Error fetching inbox:", inboxError);
            toast({ title: "Error", description: "Failed to load inbox.", variant: "destructive" });
        } else if (inboxData) {
            setInbox(inboxData);
        }

        // Fetch Sent (keep as is for now, or create RPC if needed. Schema is simple select)
        const { data: sentData } = await supabase
            .from("notifications")
            .select("*")
            .eq("sender_id", user.id)
            .order("created_at", { ascending: false });

        if (sentData) setSent(sentData);
        setLoadingLists(false);
    };

    const handleSend = async () => {
        if (!title || !message) {
            toast({ title: "Validation Error", description: "Title and message are required.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            let roleArg = null;
            if (targetType === "role" && selectedRole !== "all") {
                roleArg = selectedRole;
            } else if (targetType === "broadcast" || selectedRole === "all") {
                roleArg = null;
            }

            const { data, error } = await supabase.rpc("send_broadcast_notification", {
                p_title: title,
                p_message: message,
                p_role: roleArg
            });

            if (error) throw error;

            toast({
                title: "Notification Sent",
                description: `Successfully sent to ${data} recipients.`
            });

            // Reset Form and Refresh Lists
            setTitle("");
            setMessage("");
            fetchMessages();

        } catch (error: any) {
            console.error("Send Error:", error);
            toast({ title: "Failed to send", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
        setInbox(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const MessageList = ({ messages, type }: { messages: any[], type: "inbox" | "sent" }) => (
        <ScrollArea className="h-[500px] border rounded-md p-4 bg-muted/20">
            {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">No messages found.</div>
            ) : (
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <Card key={msg.id} className={`cursor-pointer transition-all hover:bg-slate-50 ${!msg.is_read && type === "inbox" ? "border-l-4 border-l-blue-500 bg-blue-50/10" : ""}`}
                            onClick={() => type === "inbox" && !msg.is_read ? markAsRead(msg.id) : null}
                        >
                            <CardHeader className="p-4 pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            {msg.title}
                                            {type === "inbox" && !msg.is_read && <Badge variant="default" className="h-5 text-[10px]">NEW</Badge>}
                                        </CardTitle>
                                        <div className="flex flex-col gap-1">
                                            <CardDescription className="text-xs">
                                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                            </CardDescription>
                                            {type === "inbox" && (
                                                <div className="flex gap-2 text-xs text-muted-foreground">
                                                    <span className="font-medium text-slate-700">{msg.sender_name || "Unknown"}</span>
                                                    <span>•</span>
                                                    <span>{msg.sender_role ? msg.sender_role.replace("_", " ").toUpperCase() : "USER"}</span>
                                                    <span>•</span>
                                                    <span className="text-emerald-600">{msg.sender_branch || "Head Office"}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {type === "sent" && msg.recipient_id && (
                                        <Badge variant="outline" className="text-xs">
                                            To: {msg.recipient_id.slice(0, 8)}...
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 text-sm text-slate-700 whitespace-pre-wrap">
                                {msg.message}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </ScrollArea>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notification Center</h1>
                    <p className="text-muted-foreground">Manage communications.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loadingLists}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingLists ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <Tabs defaultValue="compose" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
                    <TabsTrigger value="compose">Compose</TabsTrigger>
                    <TabsTrigger value="inbox">Inbox ({inbox.filter(n => !n.is_read).length})</TabsTrigger>
                    <TabsTrigger value="sent">Sent</TabsTrigger>
                </TabsList>

                <TabsContent value="compose" className="mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Compose Notification</CardTitle>
                            <CardDescription>Send a message to a specific group or all users.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Recipient Group</label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Recipients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Check: All Users (Broadcast)</SelectItem>
                                        <SelectItem value="admin">Admins</SelectItem>
                                        <SelectItem value="receptionist">Receptionists</SelectItem>
                                        <SelectItem value="doctor">Doctors</SelectItem>
                                        <SelectItem value="branch_director">Branch Directors</SelectItem>
                                        <SelectItem value="marketer">Marketers</SelectItem>
                                        <SelectItem value="member">Members</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input
                                    placeholder="e.g. System Maintenance Update"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Message</label>
                                <Textarea
                                    placeholder="Type your message here..."
                                    className="min-h-[100px]"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>

                            <Button className="w-full" onClick={handleSend} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Send Notification
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inbox" className="mt-6">
                    <MessageList messages={inbox} type="inbox" />
                </TabsContent>

                <TabsContent value="sent" className="mt-6">
                    <MessageList messages={sent} type="sent" />
                </TabsContent>
            </Tabs>
        </div>
    );
}
