import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Stethoscope, ClipboardList, LogOut, History, LayoutDashboard, Calendar as CalendarIcon, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
    { title: "Dashboard", url: "/doctor", icon: LayoutDashboard },
    { title: "My Schedule", url: "/doctor/schedule", icon: CalendarIcon },
    { title: "Today's Queue", url: "/doctor/queue", icon: ClipboardList },
    { title: "Patient History", url: "/doctor/history", icon: History },
    { title: "Messages", url: "/doctor/messages", icon: MessageSquare },
];

export function DoctorSidebar() {
    const { state } = useSidebar();
    const collapsed = state === "collapsed";
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const isActive = (path: string) => {
        if (path === "/doctor") return location.pathname === "/doctor";
        return location.pathname.startsWith(path);
    }

    return (
        <Sidebar collapsible="icon" className="border-r border-border">
            <SidebarHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <Stethoscope className="text-white h-6 w-6" />
                    </div>
                    {!collapsed && (
                        <div>
                            <span className="text-lg font-serif font-bold text-foreground">Elephant Dental</span>
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Doctor</span>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Clinical</SidebarGroupLabel>
                    <SidebarMenu>
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                                    <a
                                        href={item.url}
                                        onClick={(e) => { e.preventDefault(); navigate(item.url); }}
                                        className="flex items-center gap-3"
                                    >
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
                    {!collapsed && <span>Logout</span>}
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}