import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    LayoutDashboard,
    Users,
    Banknote,
    LogOut,
    UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { NotificationBell } from "../notifications/NotificationBell";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarFooter,
    useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/super-agent" },
    { icon: Users, label: "Marketers", href: "/super-agent/marketers" },
    { icon: Banknote, label: "Commissions", href: "/super-agent/commissions" },
    { icon: UserPlus, label: "Add Member", href: "/super-agent/add-member" },
];

function SuperAgentSidebar({
    userName,
    userEmail,
    onLogout,
    settings,
}: {
    userName: string | null;
    userEmail: string | null;
    onLogout: () => void;
    settings: any;
}) {
    const { state } = useSidebar();
    const collapsed = state === "collapsed";
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (href: string) => {
        if (href === "/super-agent") return location.pathname === "/super-agent";
        return location.pathname.startsWith(href);
    };

    return (
        <Sidebar collapsible="icon" className="border-r border-border/60 transition-all duration-500">
            <SidebarHeader className="p-4 border-b border-border/40 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
                <div className={cn("flex items-center transition-all duration-500", collapsed ? "justify-center gap-0" : "gap-4")}>
                    <div className={cn(
                        "flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl transform transition-all duration-500",
                        collapsed ? "p-1.5 h-10 w-10 shadow-none border-transparent" : "p-2.5 h-16 w-16 shadow-xl shadow-indigo-500/10"
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
                            <div className="flex items-center gap-2 mt-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full w-fit shadow-lg shadow-indigo-500/20">
                                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
                                    Super Agent
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        Management
                    </SidebarGroupLabel>
                    <SidebarMenu className="gap-2 px-2">
                        {navItems.map((item) => (
                            <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive(item.href)}
                                    tooltip={item.label}
                                    className={cn(
                                        "h-12 w-full transition-all duration-300 rounded-xl group/btn relative overflow-hidden",
                                        isActive(item.href)
                                            ? "bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                                    )}
                                >
                                    <a
                                        href={item.href}
                                        onClick={(e) => { e.preventDefault(); navigate(item.href); }}
                                        className="flex items-center gap-3 w-full px-3"
                                    >
                                        <div className={cn(
                                            "flex items-center justify-center transition-all duration-300",
                                            isActive(item.href) ? "transform scale-110" : "group-hover/btn:scale-110"
                                        )}>
                                            <item.icon className={cn(
                                                "h-5 w-5 transition-colors duration-300",
                                                isActive(item.href) ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-300 group-hover/btn:text-indigo-600 dark:group-hover/btn:text-indigo-300"
                                            )} />
                                        </div>
                                        <span className={cn(
                                            "font-semibold text-sm tracking-tight transition-all duration-300",
                                            isActive(item.href) ? "opacity-100" : "opacity-80 group-hover/btn:opacity-100"
                                        )}>{item.label}</span>

                                        {isActive(item.href) && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-r-full animate-in slide-in-from-left-full duration-500" />
                                        )}
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-border/40">
                {!collapsed && (
                    <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-indigo-50/50 dark:bg-slate-800/50 rounded-xl border border-indigo-100 dark:border-slate-700/50 animate-in fade-in duration-500">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/20 shrink-0">
                            {userName ? userName.charAt(0).toUpperCase() : "S"}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-bold truncate text-slate-800 dark:text-white">{userName || "Super Agent"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
                        </div>
                    </div>
                )}
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:text-rose-600 transition-all duration-300"
                    onClick={onLogout}
                >
                    <LogOut className="h-5 w-5" />
                    {!collapsed && <span className="font-semibold">Sign Out</span>}
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}

export const SuperAgentLayout = () => {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { settings } = useSystemSettings();
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        if (settings.maintenance_mode === "true" && role !== "admin" && role !== "super_admin") {
            navigate("/maintenance");
        }
    }, [settings.maintenance_mode, role, navigate]);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate("/login"); return; }
            setUserEmail(user.email);

            const { data: roleData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .single();

            const userRole = roleData?.role as string;
            setRole(userRole);

            if (userRole !== "super_agent" && userRole !== "super_admin" && userRole !== "admin") {
                toast({ title: "Access Denied", description: "This portal is restricted to Super Agents.", variant: "destructive" });
                navigate("/login");
                return;
            }

            const { data: staffData } = await supabase
                .from("staff")
                .select("full_name")
                .eq("user_id", user.id)
                .maybeSingle();

            if (staffData) setUserName(staffData.full_name);
        };

        checkAuth();
    }, [navigate, toast]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-background">
                <SuperAgentSidebar
                    userName={userName}
                    userEmail={userEmail}
                    onLogout={handleLogout}
                    settings={settings}
                />
                <SidebarInset className="flex-1">
                    <header className="h-14 border-b border-border/60 flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
                        <SidebarTrigger className="mr-4" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Super Agent Portal</span>
                        <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
                            <NotificationBell />
                            <span className="hidden md:inline">
                                Welcome, <span className="font-bold text-indigo-700">{userName || "Super Agent"}</span>
                            </span>
                        </div>
                    </header>
                    <main className="p-6">
                        <Outlet />
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
};
