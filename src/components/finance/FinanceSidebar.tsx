import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DollarSign, History, LogOut, LayoutDashboard, Users, Building2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/finance", icon: LayoutDashboard },
    { title: "Marketer Payments", url: "/finance/marketer-payments", icon: Users },
    { title: "Branch Payments", url: "/finance/branch-payments", icon: Building2 },
    { title: "Payment History", url: "/finance/history", icon: History },
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
                    <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center shrink-0">
                        <DollarSign className="text-white h-6 w-6" />
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
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={location.pathname === item.url} tooltip={item.title}>
                                    <a href={item.url} onClick={(e) => { e.preventDefault(); navigate(item.url); }} className="flex items-center gap-3">
                                        <item.icon className="h-5 w-5" />
                                        <span>{item.title}</span>
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
                    <span>Logout</span>
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}