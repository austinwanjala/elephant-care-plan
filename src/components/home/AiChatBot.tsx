import React, { useState, useRef, useEffect } from "react";
import {
    MessageCircle,
    X,
    Send,
    Sparkles,
    Minimize2,
    Trash2,
    User,
    Bot,
    Loader2,
    ChevronDown,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export const AiChatBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showNudge, setShowNudge] = useState(false);
    const [message, setMessage] = useState("");
    const [history, setHistory] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const quickActions = [
        "How do I join?",
        "What is 2x coverage?",
        "Where are your branches?",
        "Check my balance"
    ];

    useEffect(() => {
        // Show nudge after 3 seconds if chat isn't open
        const timer = setTimeout(() => {
            if (!isOpen) {
                setShowNudge(true);
            }
        }, 4000);

        return () => clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [history]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || message;
        if (!messageText.trim()) return;

        const newHistory: Message[] = [...history, { role: "user", content: messageText }];
        setHistory(newHistory);
        setMessage("");
        setIsLoading(true);
        setShowNudge(false);

        try {
            const { data, error } = await supabase.functions.invoke("ai-chatbot", {
                body: { message: messageText, history },
            });

            if (error) throw error;

            setHistory([...newHistory, { role: "assistant", content: data.response }]);
        } catch (error) {
            console.error("Chat error:", error);
            setHistory([...newHistory, {
                role: "assistant",
                content: "Oops! I encountered an error. Please try again soon or contact support at +254 710 500 500."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setHistory([]);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
            {/* Floating Button */}
            {!isOpen && (
                <div className="relative pointer-events-auto">
                    {showNudge && (
                        <div className="absolute -top-16 right-0 bg-white px-4 py-2 rounded-2xl shadow-xl text-emerald-800 text-sm font-bold animate-in slide-in-from-bottom-2 fade-in duration-500 border border-emerald-100 flex items-center gap-2 whitespace-nowrap">
                            <span>Hi! I'm Effie. Questions?</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowNudge(false); }}
                                className="hover:text-red-500 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-r border-b border-emerald-100 rotate-45"></div>
                        </div>
                    )}
                    <button
                        onClick={() => { setIsOpen(true); setShowNudge(false); }}
                        className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-emerald-500/20"
                    >
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20 group-hover:opacity-40"></div>
                        <Sparkles className="w-8 h-8 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div
                    className={cn(
                        "flex flex-col w-[380px] sm:w-[420px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden transition-all duration-500 ease-out animate-in slide-in-from-bottom-10 pointer-events-auto",
                        isMinimized ? "h-20" : "h-[600px]"
                    )}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                    <Bot className="w-7 h-7" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-4 border-emerald-600 animate-pulse"></div>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-none">Effie Assistant</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                    <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold">Always here to help</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-white/10 text-white rounded-xl transition-colors"
                                onClick={() => setIsMinimized(!isMinimized)}
                            >
                                {isMinimized ? <ChevronDown className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-white/10 text-white rounded-xl transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            {/* Chat Content */}
                            <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                                <div className="space-y-4">
                                    {/* welcome message */}
                                    <div className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-500">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                                            <Bot className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]">
                                            <p className="text-sm text-slate-800 leading-relaxed">
                                                Jambo! I'm **Effie**, your virtual assistant at Elephant Dental. 🐘
                                                <br /><br />
                                                I'm here to help you understand our **2x coverage**, register members, and find our locations.
                                                <br /><br />
                                                What would you like to know today?
                                            </p>
                                        </div>
                                    </div>

                                    {history.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                                msg.role === "user" ? "flex-row-reverse" : ""
                                            )}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                                                msg.role === "user" ? "bg-slate-200 border-slate-300" : "bg-emerald-100 border-emerald-200"
                                            )}>
                                                {msg.role === "user" ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-emerald-600" />}
                                            </div>
                                            <div className={cn(
                                                "p-3 rounded-2xl shadow-sm max-w-[85%] text-sm leading-relaxed transition-all",
                                                msg.role === "user"
                                                    ? "bg-emerald-600 text-white rounded-tr-none shadow-emerald-200"
                                                    : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                                            )}>
                                                <div dangerouslySetInnerHTML={{
                                                    // Simple markdown support for bolding
                                                    __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br />')
                                                }} />
                                            </div>
                                        </div>
                                    ))}

                                    {isLoading && (
                                        <div className="flex gap-3 animate-pulse">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                                            </div>
                                            <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl rounded-tl-none text-slate-400 text-xs italic">
                                                Effie is thinking...
                                            </div>
                                        </div>
                                    )}

                                    <div ref={scrollRef} />
                                </div>
                            </ScrollArea>

                            {/* Suggestions */}
                            {history.length === 0 && !isLoading && (
                                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                                    <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider pl-1">Quick Questions</div>
                                    <div className="flex flex-wrap gap-2">
                                        {quickActions.map((action) => (
                                            <button
                                                key={action}
                                                onClick={() => handleSendMessage(action)}
                                                className="text-xs font-semibold px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-full hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
                                            >
                                                {action}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Input */}
                            <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                    className="flex gap-2"
                                >
                                    <div className="relative flex-1">
                                        <Input
                                            placeholder="Ask Effie something..."
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            disabled={isLoading}
                                            className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 rounded-2xl pr-10 py-6 transition-all shadow-inner"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            {history.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={clearChat}
                                                    className="p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                                                    title="Clear chat"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isLoading || !message.trim()}
                                        className="aspect-square h-[48px] w-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center p-0"
                                    >
                                        <Send className="w-5 h-5 ml-0.5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </Button>
                                </form>
                                <div className="flex items-center justify-center gap-1.5 mt-3">
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Powered by Elephant Dental Intelligence</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
