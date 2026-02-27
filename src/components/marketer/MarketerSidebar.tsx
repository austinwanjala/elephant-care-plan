import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, Link2, LogOut, LayoutDashboard, Megaphone, UserPlus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/marketer", icon: LayoutDashboard },
    { title: "Add Member", url: "/marketer/add-member", icon: UserPlus },
    { title: "My Referrals", url: "/marketer/referrals", icon: Users },
    { title: "Earnings", url: "/marketer/earnings", icon: DollarSign },
    { title: "Marketing Links", url: "/marketer/links", icon: Link2 },
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
        <Sidebar collapsible="icon" className="border-r border-border">
            <SidebarHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                        <Megaphone className="text-white h-6 w-6" />
                    </div>
                    {!collapsed && (
                        <div>
                            <span className="text-lg font-serif font-bold text-foreground">{settings.app_name || "Elephant Dental"}</span>
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Marketer</span>
                        </div>
                    )}
                </div>
            </SidebarHeader>


            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Marketing</SidebarGroupLabel>
                    <SidebarMenu>
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                                    <a
                                        href={item.url}
                                        onClick={(e) => { e.preventDefault(); navigate(item.url); }}
                                        className="flex items-center gap-3 justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="h-5 w-5" />
                                            <span>{item.title}</span>
                                        </div>
                                        {item.title === "Earnings" && claimableAmount > 0 && (
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
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