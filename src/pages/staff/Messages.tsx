import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, User, Loader2, ArrowLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function StaffMessages() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [staff, setStaff] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        initSession();
    }, []);

    const initSession = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staffMember } = await supabase
            .from("staff")
            .select("*, branches(name)")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffMember) {
            setCurrentUser(staffMember);
            fetchStaff(staffMember.id);
            fetchMessages(staffMember.id);
        }
    };

    useEffect(() => {
        if (!currentUser) return;

        const channel = supabase
            .channel(`messages-${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'portal_messages',
                },
                (payload) => {
                    // Check if message is already in list (for sender who added it manually)
                    setMessages(prev => {
                        if (prev.find(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    useEffect(() => {
        if (selectedStaff && currentUser) {
            markMessagesAsRead(selectedStaff.id);
        }
    }, [selectedStaff, messages, currentUser]); // Added currentUser to dependencies

    const markMessagesAsRead = async (senderId: string) => {
        const unreadIds = messages
            .filter(m => m.sender_id === senderId && m.recipient_id === currentUser.id && !m.is_read)
            .map(m => m.id);

        if (unreadIds.length > 0) {
            const { error } = await supabase
                .from("portal_messages")
                .update({ is_read: true })
                .in("id", unreadIds);

            if (!error) {
                setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
            }
        }
    };

    const fetchStaff = async (currentStaffId: string) => {
        const { data } = await supabase
            .from("staff")
            .select("id, full_name, role, phone, email, branches(name)")
            .neq("id", currentStaffId)
            .neq("role", "member"); // Ensure patients/members don't show up in staff list
        setStaff(data || []);
    };

    const fetchMessages = async (currentStaffId: string) => {
        const { data } = await supabase
            .from("portal_messages")
            .select("*, sender:staff!portal_messages_sender_id_fkey(full_name), is_read")
            .or(`recipient_id.eq.${currentStaffId},sender_id.eq.${currentStaffId}`)
            .order("created_at", { ascending: true });

        setMessages(data || []);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, selectedStaff]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentUser || !selectedStaff) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.from("portal_messages").insert({
                sender_id: currentUser.id,
                recipient_id: selectedStaff.id,
                content: newMessage,
                branch_id: currentUser.branch_id,
                is_read: false
            }).select().single();

            if (error) throw error;

            if (data) {
                setMessages(prev => {
                    if (prev.find(m => m.id === data.id)) return prev;
                    return [...prev, data];
                });
            }

            setNewMessage("");
        } catch (error: any) {
            toast({ title: "Failed to send", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const filteredStaff = staff.sort((a, b) => {
        // Sort by last message date
        const lastA = [...messages].reverse().find(m =>
            (m.sender_id === a.id && m.recipient_id === currentUser.id) ||
            (m.sender_id === currentUser.id && m.recipient_id === a.id)
        )?.created_at || '0';
        const lastB = [...messages].reverse().find(m =>
            (m.sender_id === b.id && m.recipient_id === currentUser.id) ||
            (m.sender_id === currentUser.id && m.recipient_id === b.id)
        )?.created_at || '0';
        return new Date(lastB).getTime() - new Date(lastA).getTime();
    }).filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.branches?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!currentUser) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );

    return (
        <div className="container mx-auto p-4 max-w-6xl h-[calc(100vh-120px)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                {/* Conversations List */}
                <Card className="md:col-span-1 flex flex-col overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                            Staff Directory
                        </CardTitle>
                        <div className="relative mt-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search staff..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {filteredStaff.map(s => {
                                const unreadCount = messages.filter(m =>
                                    m.sender_id === s.id &&
                                    m.recipient_id === currentUser.id &&
                                    !m.is_read
                                ).length;

                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedStaff(s)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group relative",
                                            selectedStaff?.id === s.id
                                                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                                                : "hover:bg-slate-100 text-slate-900"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-12 w-12 rounded-full flex items-center justify-center relative",
                                            selectedStaff?.id === s.id ? "bg-blue-400" : "bg-slate-200 text-slate-500"
                                        )}>
                                            <User className="h-6 w-6" />
                                            {unreadCount > 0 && selectedStaff?.id !== s.id && (
                                                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white">
                                                    {unreadCount}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-center">
                                                <div className="font-semibold truncate">{s.full_name}</div>
                                            </div>
                                            <div className={cn(
                                                "text-[10px] uppercase font-bold tracking-wider mb-0.5",
                                                selectedStaff?.id === s.id ? "text-blue-100" : "text-slate-500"
                                            )}>{s.role} • {s.branches?.name || 'N/A'}</div>
                                            <div className={cn(
                                                "text-[9px] font-medium opacity-70",
                                                selectedStaff?.id === s.id ? "text-blue-50" : "text-slate-400"
                                            )}>
                                                {s.phone && <span>{s.phone}</span>}
                                                {s.phone && s.email && <span> • </span>}
                                                {s.email && <span className="truncate">{s.email}</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Chat Window */}
                <Card className="md:col-span-2 flex flex-col overflow-hidden bg-slate-50 relative">
                    {selectedStaff ? (
                        <>
                            <CardHeader className="bg-white border-b py-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{selectedStaff.full_name}</CardTitle>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                                            <span className="font-bold text-slate-700">{selectedStaff.role}</span>
                                            <span>•</span>
                                            <span>{selectedStaff.branches?.name}</span>
                                            {selectedStaff.phone && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1 font-medium text-blue-600">{selectedStaff.phone}</span>
                                                </>
                                            )}
                                            {selectedStaff.email && (
                                                <>
                                                    <span>•</span>
                                                    <span className="opacity-70">{selectedStaff.email}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                                <div className="space-y-4">
                                    {messages
                                        .filter(m => (m.sender_id === selectedStaff.id && m.recipient_id === currentUser.id) ||
                                            (m.sender_id === currentUser.id && m.recipient_id === selectedStaff.id))
                                        .map((m, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "flex flex-col max-w-[75%] rounded-2xl p-4 text-sm shadow-sm",
                                                    m.sender_id === currentUser.id
                                                        ? "ml-auto bg-blue-600 text-white rounded-tr-none"
                                                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                                )}
                                            >
                                                {m.content}
                                                <div className={cn(
                                                    "text-[10px] mt-1.5 opacity-60",
                                                    m.sender_id === currentUser.id ? "text-right" : "text-left"
                                                )}>
                                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {messages.filter(m => (m.sender_id === selectedStaff.id && m.recipient_id === currentUser.id) ||
                                        (m.sender_id === currentUser.id && m.recipient_id === selectedStaff.id)).length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                                <MessageSquare className="h-12 w-12 opacity-10 mb-2" />
                                                <p className="text-sm italic">No messages with {selectedStaff.full_name.split(' ')[0]} yet.</p>
                                            </div>
                                        )}
                                </div>
                            </ScrollArea>

                            <div className="p-4 bg-white border-t">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }}
                                    className="flex gap-3"
                                >
                                    <Input
                                        placeholder="Type your message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="py-6 bg-slate-50 border-slate-200"
                                        disabled={loading}
                                    />
                                    <Button type="submit" size="icon" disabled={loading || !newMessage.trim()} className="h-auto w-14 bg-blue-600 hover:bg-blue-700">
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    </Button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <MessageSquare className="h-10 w-10 opacity-30" />
                            </div>
                            <h3 className="text-slate-900 font-semibold mb-1 text-lg">Your Inbox</h3>
                            <p className="max-w-[280px]">Select a staff member from the left to start a real-time conversation.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
