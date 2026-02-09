import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DollarSign, ClipboardList, LogOut, LayoutDashboard, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/finance", icon: LayoutDashboard },
    { title: "Marketer Payouts", url: "/finance/marketer-claims", icon: DollarSign },
    { title: "Branch Payouts", url: "/finance/branch-claims", icon: Wallet },
];

export function FinanceSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    return (
        <Sidebar collapsible="icon" className="border-r border-border">
            <SidebarHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center shrink-0">
                        <DollarSign className="text-white h-6 w-6" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-serif font-bold">Elephant Dental</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 rounded-full w-fit">Finance</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                                    <a href={item.url} onClick={(e) => { e.preventDefault(); navigate(item.url); }}>
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