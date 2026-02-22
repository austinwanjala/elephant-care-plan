import { useState, useEffect } from "react";
import { Bell, Reply, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea"; // Ensure this exists or use Input
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);

    // Reply State
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyMessage, setReplyMessage] = useState("");
    const [sendingReply, setSendingReply] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchNotifications();

        // Subscribe to new notifications
        const channel = supabase
            .channel("notifications")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `recipient_id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}`,
                },
                (payload) => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (!open) {
            setReplyingTo(null);
            setReplyMessage("");
        }
    }, [open]);

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter((n) => !n.is_read).length);
        }
    };

    const markAsRead = async (id: string) => {
        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id);

        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("recipient_id", user.id)
            .eq("is_read", false);

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    }

    const handleReply = async (notification: any) => {
        if (!replyMessage.trim()) return;

        setSendingReply(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase.from("notifications").insert({
                sender_id: user.id,
                recipient_id: notification.sender_id, // Reply to sender
                title: `Re: ${notification.title}`,
                message: replyMessage,
                parent_id: notification.id,
                is_read: false
            });

            if (error) throw error;

            toast({ title: "Reply sent", description: "Your reply has been sent." });
            setReplyingTo(null);
            setReplyMessage("");

        } catch (error: any) {
            console.error("Reply error:", error);
            toast({ title: "Failed to reply", description: error.message, variant: "destructive" });
        } finally {
            setSendingReply(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 rounded-full text-[10px]">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-auto text-xs text-blue-600 font-bold" onClick={() => {
                            setOpen(false);
                            // Determine route based on current path or just use a generic /messages if we fix routing
                            const path = window.location.pathname;
                            const prefix = path.split('/')[1];
                            if (prefix && prefix !== 'login' && prefix !== 'register') {
                                window.location.href = `/${prefix}/messages`;
                            } else {
                                window.location.href = `/doctor/messages`; // default
                            }
                        }}>
                            Messages
                        </Button>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" className="h-auto text-xs text-muted-foreground" onClick={markAllAsRead}>
                                Mark all
                            </Button>
                        )}
                    </div>
                </div>
                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No notifications
                        </div>
                    ) : (
                        <div className="grid gap-1">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b last:border-0 hover:bg-slate-50 transition-colors ${!notification.is_read ? "bg-blue-50/50" : ""}`}
                                >
                                    <div
                                        className="cursor-pointer"
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <h5 className={`text-sm ${!notification.is_read ? "font-semibold" : "font-medium"}`}>
                                                {notification.title}
                                            </h5>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {notification.message}
                                        </p>
                                    </div>

                                    {/* Reply Action */}
                                    {notification.sender_id && (
                                        <div className="mt-2">
                                            {replyingTo === notification.id ? (
                                                <div className="space-y-2 mt-2 pt-2 border-t">
                                                    <Textarea
                                                        value={replyMessage}
                                                        onChange={(e) => setReplyMessage(e.target.value)}
                                                        placeholder="Write a reply..."
                                                        className="min-h-[60px] text-xs"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setReplyingTo(null)}>
                                                            Cancel
                                                        </Button>
                                                        <Button size="sm" className="h-7 text-xs" onClick={() => handleReply(notification)} disabled={sendingReply}>
                                                            {sendingReply ? "Sending..." : "Send"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] text-slate-500 hover:text-blue-600 px-0 mt-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReplyingTo(notification.id);
                                                    }}
                                                >
                                                    <Reply className="h-3 w-3 mr-1" /> Reply
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
