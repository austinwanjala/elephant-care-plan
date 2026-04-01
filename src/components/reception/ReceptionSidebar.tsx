import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { UserPlus, Landmark, Receipt, LogOut, Building2, Search, CalendarClock, MessageSquare, ClipboardPlus, Contact2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/reception", icon: Building2 },
    { title: "Register Visit", url: "/reception/register-visit", icon: ClipboardPlus },
    { title: "Add Member", url: "/reception/add-member", icon: UserPlus },
    { title: "Search Member", url: "/reception/search", icon: Contact2 },
    { title: "Appointments", url: "/reception/appointments", icon: CalendarClock },
    { title: "Billing & Claims", url: "/reception/billing", icon: Receipt },
    { title: "Messages", url: "/reception/messages", icon: MessageSquare },
];

import { useSystemSettings } from "@/hooks/useSystemSettings";

export function ReceptionSidebar() {
    const { state } = useSidebar();
    const collapsed = state === "collapsed";
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSystemSettings();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const isActive = (path: string) => {
        if (path === "/reception") return location.pathname === "/reception";
        return location.pathname.startsWith(path);
    }

    const [pendingBillsCount, setPendingBillsCount] = useState(0);

    useEffect(() => {
        const fetchPendingBills = async () => {
            const { count } = await (supabase as any)
                .from('visits')
                .select('*', { count: 'exact', head: true })
                .in('status', ['billed', 'billing_pending']);
            setPendingBillsCount(count || 0);
        };

        fetchPendingBills();

        // Polling every 30s
        const interval = setInterval(fetchPendingBills, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Sidebar collapsible="icon" className="border-r border-border/60 transition-all duration-500">
            <SidebarHeader className="p-4 border-b border-border/40 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
                <div className={cn("flex items-center transition-all duration-500", collapsed ? "justify-center gap-0" : "gap-4")}>
                    <div className={cn(
                        "flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl transform transition-all duration-500",
                        collapsed ? "p-1.5 h-10 w-10 shadow-none border-transparent" : "p-2.5 h-16 w-16 shadow-xl shadow-blue-500/10"
                    )}>
                        <img 
                            src="/img/elephantlogo.jpg" 
                            alt="Elephant Logo" 
                            className={cn(
                                "w-auto object-contain rounded-xl transition-all duration-500", 
                                collapsed ? "h-7" : "h-12"
                            )} 
                        />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-700">
                            <span className="text-xl font-serif font-black text-slate-900 dark:text-white leading-[1.1] truncate tracking-tight">
                                {settings.app_name || "Elephant Dental"}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full w-fit shadow-lg shadow-blue-500/20">
                                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
                                    Reception Portal
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </SidebarHeader>


            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Front Desk</SidebarGroupLabel>
                    <SidebarMenu className="gap-2 px-2">
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive(item.url)}
                                    tooltip={item.title}
                                    className={cn(
                                        "h-12 w-full transition-all duration-300 rounded-xl group/btn relative overflow-hidden",
                                        isActive(item.url) 
                                            ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400" 
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                                    )}
                                >
                                    <a
                                        href={item.url}
                                        onClick={(e) => { e.preventDefault(); navigate(item.url); }}
                                        className="flex items-center gap-3 w-full px-3"
                                    >
                                        <div className={cn(
                                            "flex items-center justify-center transition-all duration-300",
                                            isActive(item.url) ? "transform scale-110" : "group-hover/btn:scale-110"
                                        )}>
                                            <item.icon className={cn(
                                                "h-5 w-5 transition-colors duration-300",
                                                isActive(item.url) ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover/btn:text-slate-600 dark:group-hover/btn:text-slate-200"
                                            )} />
                                        </div>
                                        <span className={cn(
                                            "font-semibold text-sm tracking-tight transition-all duration-300",
                                            isActive(item.url) ? "opacity-100" : "opacity-80 group-hover/btn:opacity-100"
                                        )}>{item.title}</span>
                                        
                                        {/* Professional Active Indicator */}
                                        {isActive(item.url) && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full animate-in slide-in-from-left-full duration-500" />
                                        )}
                                        
                                        {item.title === "Billing & Claims" && pendingBillsCount > 0 && (
                                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-lg shadow-red-500/30">
                                                {pendingBillsCount}
                                            </span>
                                        )}
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-border">
                <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                    {!collapsed && <span>Logout</span>}
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}
