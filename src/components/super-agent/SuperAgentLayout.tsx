import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    LayoutDashboard,
    Users,
    Banknote,
    LogOut,
    Menu,
    X,
    Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { NotificationBell } from "../notifications/NotificationBell";
import { useSystemSettings } from "@/hooks/useSystemSettings";

export const SuperAgentLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const location = useLocation();
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
            if (!user) {
                navigate("/login");
                return;
            }
            setUserEmail(user.email);

            // Verify Role
            const { data: roleData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .single();

            const userRole = roleData?.role as string;
            setRole(userRole);

            if (userRole !== "super_agent" && userRole !== "super_admin" && userRole !== "admin") {
                toast({
                    title: "Access Denied",
                    description: "This portal is restricted to Super Agents.",
                    variant: "destructive",
                });
                navigate("/login");
                return;
            }

            // Fetch Staff Name
            const { data: staffData } = await supabase
                .from("staff")
                .select("full_name")
                .eq("user_id", user.id)
                .maybeSingle();

            if (staffData) {
                setUserName(staffData.full_name);
            }
        };

        checkAuth();
    }, [navigate, toast]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    const navItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/super-agent" },
        { icon: Users, label: "Marketers", href: "/super-agent/marketers" },
        { icon: Banknote, label: "Commissions", href: "/super-agent/commissions" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-[#0e1726] text-white fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
                        <Briefcase className="h-8 w-8 text-indigo-400" />
                        <div>
                            <h1 className="font-bold text-xl tracking-wide">{settings.app_name || "Elephant Dental"}</h1>
                            <p className="text-xs text-slate-400">Super Agent Portal</p>
                        </div>
                        <button
                            className="ml-auto lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            let isActive = location.pathname === item.href;
                            if (item.href !== "/super-agent" && location.pathname.startsWith(item.href)) {
                                isActive = true;
                            }
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                                        isActive
                                            ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-900/20"
                                            : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5", isActive ? "text-indigo-100" : "text-slate-400")} />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-800/50 rounded-xl">
                            <div className="h-10 w-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold border border-indigo-700/50">
                                {userName ? userName.charAt(0) : "S"}
                            </div>
                            <div className="overflow-hidden flex-1">
                                <p className="text-sm font-semibold truncate text-white">{userName || "Super Agent"}</p>
                                <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            className="w-full justify-start select-none bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border-0"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-4 w-4" /> Sign Out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm p-4 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600">
                            <Menu className="h-6 w-6" />
                        </Button>
                        <h1 className="font-bold text-lg text-slate-800 lg:hidden">Super Agent Portal</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                        <NotificationBell />
                        <span className="hidden md:inline font-medium">Welcome back, <span className="font-bold text-indigo-700">{userName || "Super Agent"}</span></span>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-8 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-track]:bg-transparent">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
