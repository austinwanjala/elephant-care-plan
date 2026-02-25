import { useState, useEffect } from "react";
import { Bell, Reply, Send, User } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentStaff, setCurrentStaff] = useState<any>(null);

    // Reply State
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyMessage, setReplyMessage] = useState("");
    const [sendingReply, setSendingReply] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        initSession();
    }, []);

    const initSession = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUser(user);

        // Also fetch staff info if this is a staff member
        const { data: staff } = await supabase
            .from("staff")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
        setCurrentStaff(staff);

        fetchNotifications(user.id, staff);
    };

    useEffect(() => {
        if (!currentUser) return;

        // 1. Subscribe to notifications
        const notifChannel = supabase
            .channel(`notifications-${currentUser.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `recipient_id=eq.${currentUser.id}`,
                },
                () => {
                    fetchNotifications(currentUser.id, currentStaff);
                }
            )
            .subscribe();

        // 2. Subscribe to portal_messages if current user is staff
        let msgChannel: any = null;
        if (currentStaff) {
            msgChannel = supabase
                .channel(`portal-notifs-${currentStaff.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "portal_messages",
                        filter: `recipient_id=eq.${currentStaff.id}`,
                    },
                    () => {
                        fetchNotifications(currentUser.id, currentStaff);
                    }
                )
                .subscribe();
        }

        return () => {
            supabase.removeChannel(notifChannel);
            if (msgChannel) supabase.removeChannel(msgChannel);
        };
    }, [currentUser, currentStaff]);

    useEffect(() => {
        if (!open) {
            setReplyingTo(null);
            setReplyMessage("");
        }
    }, [open]);

    const fetchNotifications = async (userId: string, staff: any) => {
        // Fetch regular notifications
        const { data: notifs } = await supabase
            .from("notifications")
            .select("*")
            .eq("recipient_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);

        let combined = [...(notifs || [])];

        // If staff, also fetch unread portal messages as "notifications"
        if (staff) {
            const { data: msgs } = await supabase
                .from("portal_messages")
                .select("*, sender:staff!portal_messages_sender_id_fkey(full_name)")
                .eq("recipient_id", staff.id)
                .eq("is_read", false)
                .order("created_at", { ascending: false })
                .limit(10);

            if (msgs) {
                const msgNotifs = msgs.map(m => ({
                    id: m.id,
                    title: `Message from ${m.sender?.full_name || 'Staff'}`,
                    message: m.content,
                    created_at: m.created_at,
                    is_read: false,
                    type: 'message',
                    sender_id: m.sender_id,
                    is_portal_message: true
                }));
                combined = [...msgNotifs, ...combined].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
            }
        }

        setNotifications(combined);
        setUnreadCount(combined.filter((n) => !n.is_read).length);
    };

    const markAsRead = async (notification: any) => {
        if (notification.is_portal_message) {
            // It's a portal message, mark it as read in portal_messages table
            await supabase
                .from("portal_messages")
                .update({ is_read: true })
                .eq("id", notification.id);
        } else {
            // It's a regular notification
            await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", notification.id);
        }

        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        if (!currentUser) return;

        try {
            // Mark regular notifications as read
            const { error: notifError } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("recipient_id", currentUser.id)
                .eq("is_read", false);

            if (notifError) throw notifError;

            // If staff, also mark portal messages as read
            if (currentStaff) {
                const { error: msgError } = await supabase
                    .from("portal_messages")
                    .update({ is_read: true })
                    .eq("recipient_id", currentStaff.id)
                    .eq("is_read", false);

                if (msgError) throw msgError;
            }

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            toast({ title: "Done", description: "All notifications marked as read." });

        } catch (error: any) {
            console.error("Mark all as read error:", error);
            toast({ title: "Error", description: "Failed to mark all as read: " + error.message, variant: "destructive" });
        }
    }

    const handleReply = async (notification: any) => {
        if (!replyMessage.trim()) return;

        setSendingReply(true);
        try {
            if (!currentUser) throw new Error("Not authenticated");

            if (notification.is_portal_message && currentStaff) {
                // Reply via portal_messages
                const { error } = await supabase.from("portal_messages").insert({
                    sender_id: currentStaff.id,
                    recipient_id: notification.sender_id,
                    content: replyMessage,
                    branch_id: currentStaff.branch_id
                });
                if (error) throw error;
            } else {
                // Reply via notifications
                const { error } = await supabase.from("notifications").insert({
                    sender_id: currentUser.id,
                    recipient_id: notification.sender_id, // Reply to sender
                    title: `Re: ${notification.title}`,
                    message: replyMessage,
                    parent_id: notification.id,
                    is_read: false
                });
                if (error) throw error;
            }

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
                                        onClick={() => markAsRead(notification)}
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
