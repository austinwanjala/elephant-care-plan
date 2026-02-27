import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Coins, Receipt, Landmark, LogOut, LayoutDashboard, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/finance", icon: LayoutDashboard },
    { title: "Marketer Payments", url: "/finance/marketer-payments", icon: Coins },
    { title: "Branch Payments", url: "/finance/branch-payments", icon: Landmark },
    { title: "Payment History", url: "/finance/history", icon: Receipt },
    { title: "Messages", url: "/finance/messages", icon: MessageSquare },
];

import { useSystemSettings } from "@/hooks/useSystemSettings";

export function FinanceSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSystemSettings();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <Sidebar collapsible="icon" className="border-r border-border">
            <SidebarHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-serif font-bold text-foreground">{settings.app_name || "Elephant Dental"}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full w-fit">Finance</span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Treasury</SidebarGroupLabel>
                    <SidebarMenu>
                        {menuItems.map((item) => {
                            const active = location.pathname === item.url;
                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={active}
                                        tooltip={item.title}
                                        className="h-11 transition-all duration-300"
                                    >
                                        <a
                                            href={item.url}
                                            onClick={(e) => { e.preventDefault(); navigate(item.url); }}
                                            className="flex items-center gap-3"
                                        >
                                            <div className={cn(
                                                "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300",
                                                active
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                                                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                            )}>
                                                <item.icon className="h-4 w-4" />
                                            </div>
                                            <span className={cn(
                                                "font-medium transition-colors duration-300",
                                                active ? "text-primary font-bold" : "text-slate-600"
                                            )}>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="p-4 border-t border-border">
                <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}