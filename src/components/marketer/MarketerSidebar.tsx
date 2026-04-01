import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Share2, Wallet, Users2, LogOut, LayoutDashboard, Megaphone, UserPlus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/marketer", icon: LayoutDashboard },
    { title: "Add Member", url: "/marketer/add-member", icon: UserPlus },
    { title: "My Referrals", url: "/marketer/referrals", icon: Users2 },
    { title: "Earnings", url: "/marketer/earnings", icon: Wallet },
    { title: "Marketing Links", url: "/marketer/links", icon: Share2 },
    { title: "Messages", url: "/marketer/messages", icon: MessageSquare },
];

import { useSystemSettings } from "@/hooks/useSystemSettings";

export function MarketerSidebar() {
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
        if (path === "/marketer") return location.pathname === "/marketer";
        return location.pathname.startsWith(path);
    }

    const [claimableAmount, setClaimableAmount] = useState(0);

    useEffect(() => {
        const fetchEarnings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: marketer } = await supabase
                .from("marketers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!marketer) return;

            const { data: commissions } = await (supabase as any)
                .from("marketer_commissions")
                .select("amount, status")
                .eq("marketer_id", marketer.id);

            const claimable = commissions
                ?.filter((c: any) => c.status === 'claimable')
                .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0) || 0;

            setClaimableAmount(claimable);
        };

        fetchEarnings();
    }, []);

    return (
        <Sidebar collapsible="icon" className="border-r border-border/60 transition-all duration-500">
            <SidebarHeader className="p-4 border-b border-border/40 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
                <div className={cn("flex items-center transition-all duration-500", collapsed ? "justify-center gap-0" : "gap-4")}>
                    <div className={cn(
                        "flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl transform transition-all duration-500",
                        collapsed ? "p-1.5 h-10 w-10 shadow-none border-transparent" : "p-2.5 h-16 w-16 shadow-xl shadow-purple-500/10"
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
                            <div className="flex items-center gap-2 mt-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-full w-fit shadow-lg shadow-purple-500/20">
                                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
                                    Marketer Portal
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Growth & Marketing</SidebarGroupLabel>
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
                                            ? "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400" 
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
                                                isActive(item.url) ? "text-purple-600 dark:text-purple-400" : "text-slate-400 group-hover/btn:text-purple-600 dark:group-hover/btn:text-purple-300"
                                            )} />
                                        </div>
                                        <span className={cn(
                                            "font-semibold text-sm tracking-tight transition-all duration-300",
                                            isActive(item.url) ? "opacity-100" : "opacity-80 group-hover/btn:opacity-100"
                                        )}>{item.title}</span>
                                        
                                        {isActive(item.url) && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-purple-600 dark:bg-purple-400 rounded-r-full" />
                                        )}
                                        
                                        {item.title === "Earnings" && claimableAmount > 0 && (
                                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white shadow-lg shadow-green-500/30">
                                                $
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
