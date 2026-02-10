import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { UserPlus, Fingerprint, Receipt, LogOut, LayoutDashboard, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

export function ReceptionSidebar() {
    const { state } = useSidebar();
    const collapsed = state === "collapsed";
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission, loading } = usePermissions();

    const [pendingBillsCount, setPendingBillsCount] = useState(0);

    const allMenuItems = [
        {
            title: "Dashboard",
            url: "/reception",
            icon: LayoutDashboard,
            show: hasPermission('dashboard', 'view')
        },
        {
            title: "Register Visit",
            url: "/reception/register-visit",
            icon: UserPlus,
            show: hasPermission('visits', 'create')
        },
        {
            title: "Add Member",
            url: "/reception/add-member",
            icon: UserPlus,
            show: hasPermission('members', 'create')
        },
        {
            title: "Search Member",
            url: "/reception/search",
            icon: Search,
            show: hasPermission('members', 'view')
        },
        {
            title: "Billing & Claims",
            url: "/reception/billing",
            icon: Receipt,
            show: hasPermission('financials', 'view')
        },
    ];

    const menuItems = allMenuItems.filter(item => item.show);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const isActive = (path: string) => {
        if (path === "/reception") return location.pathname === "/reception";
        return location.pathname.startsWith(path);
    };

    useEffect(() => {
        const fetchPendingBills = async () => {
            const { count } = await (supabase as any)
                .from('bills')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingBillsCount(count || 0);
        };

        fetchPendingBills();

        const channel = supabase
            .channel('reception:bills_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bills' },
                () => fetchPendingBills()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (loading) {
        return (
            <Sidebar collapsible="icon" className="border-r border-border">
                <SidebarHeader className="p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    </div>
                </SidebarHeader>
            </Sidebar>
        );
    }

    return (
        <Sidebar collapsible="icon" className="border-r border-border">
            <SidebarHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="text-xl">🐘</span>
                    </div>
                    {!collapsed && (
                        <div>
                            <span className="text-lg font-serif font-bold text-foreground">Elephant Dental</span>
                            <span className="ml-2 px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded-full">Reception</span>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Front Desk</SidebarGroupLabel>
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
                                        {item.title === "Billing & Claims" && pendingBillsCount > 0 && (
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
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