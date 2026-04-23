import React from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const WhatsAppButton = () => {
    const phoneNumber = "254710330339";
    const message = "Hello Elephant Dental, I have a question about your services.";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    return (
        <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "fixed bottom-6 right-6 z-[9999] group",
                "flex items-center gap-3 bg-[#25D366] text-white px-4 py-3 rounded-full shadow-2xl",
                "hover:scale-110 transition-all duration-300 active:scale-95",
                "animate-in slide-in-from-bottom-10 duration-500"
            )}
        >
            <div className="flex flex-col items-end mr-1">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 leading-none">Chat with us</span>
                <span className="text-sm font-bold leading-none mt-1">WhatsApp</span>
            </div>
            <div className="relative">
                <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20 group-hover:opacity-40"></div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                    <MessageSquare className="w-6 h-6 fill-white" />
                </div>
            </div>
        </a>
    );
};
