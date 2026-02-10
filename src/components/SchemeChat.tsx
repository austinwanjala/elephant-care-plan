
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function SchemeChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hi! I'm your Elephant Dental assistant. Ask me anything about our membership schemes and benefits." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke("chat-with-ai", {
                body: { query: userMessage }
            });

            if (error) throw error;

            setMessages(prev => [...prev, { role: "assistant", content: data.reply || "I'm sorry, I couldn't process that request." }]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting to the server. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* Chat Window */}
            {isOpen && (
                <Card className="w-[350px] md:w-[400px] h-[500px] shadow-2xl flex flex-col mb-4 animate-in slide-in-from-bottom-10 fade-in border-primary/20">
                    <CardHeader className="bg-primary text-primary-foreground p-4 rounded-t-lg flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <Bot className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Scheme Assistant</CardTitle>
                                <p className="text-xs opacity-90">Ask about benefits & pricing</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary-foreground hover:bg-white/20 h-8 w-8"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden relative bg-slate-50/50">
                        <ScrollArea className="h-full p-4" ref={scrollRef}>
                            <div className="space-y-4">
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "flex gap-2 max-w-[85%]",
                                            msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
                                            )}
                                        >
                                            {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                                        </div>
                                        <div
                                            className={cn(
                                                "p-3 rounded-2xl text-sm shadow-sm",
                                                msg.role === "user"
                                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                                    : "bg-white border border-border text-foreground rounded-tl-none"
                                            )}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-2 mr-auto max-w-[85%]">
                                        <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                                            <Bot className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="bg-white border border-border p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    </div>
                                )}
                                {/* Invisible div to scroll to */}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-3 bg-background border-t">
                        <form
                            className="flex w-full gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                        >
                            <Input
                                placeholder="Type your question..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="flex-1 focus-visible:ring-primary"
                                disabled={isLoading}
                            />
                            <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            {/* Floating Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 bg-primary text-primary-foreground p-0 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <MessageCircle className="h-7 w-7 relative z-10" />
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full border-2 border-white translate-x-1 -translate-y-1 animate-pulse" />
                </Button>
            )}
        </div>
    );
}
