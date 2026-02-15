import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom"; // Add useNavigate here
import { supabase } from "@/integrations/supabase/client";
import {
    LayoutDashboard,
    Users,
    FileText,
    CreditCard,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    Activity,
    History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { NotificationBell } from "../notifications/NotificationBell";

export const AuditorLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate(); // Add hook usage
    const { toast } = useToast();

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

            // @ts-ignore
            if (roleData?.role !== "auditor" && roleData?.role !== "super_admin" && roleData?.role !== "admin") {
                toast({
                    title: "Access Denied",
                    description: "This portal is restricted to Auditors.",
                    variant: "destructive",
                });
                navigate("/login");
            }
        };

        checkAuth();
    }, [navigate, toast]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    const navItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/auditor" },
        { icon: Users, label: "Members", href: "/auditor/members" },
        { icon: Activity, label: "Visits", href: "/auditor/visits" },
        { icon: CreditCard, label: "Financials", href: "/auditor/financials" },
        { icon: History, label: "System Logs", href: "/auditor/logs" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-slate-900 text-white fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-emerald-400" />
                        <div>
                            <h1 className="font-bold text-xl tracking-wide">Auditor Portal</h1>
                            <p className="text-xs text-slate-400">Read-Only Access</p>
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
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                                        isActive
                                            ? "bg-emerald-600 text-white"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <div className="flex items-center gap-3 px-4 py-3 mb-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-400 font-bold border border-emerald-700">
                                A
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium truncate text-white">Auditor</p>
                                <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            className="w-full justify-start select-none"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-4 w-4" /> Sign Out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <header className="bg-white border-b shadow-sm p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden">
                            <Menu className="h-6 w-6" />
                        </Button>
                        <h1 className="font-bold text-lg text-slate-800 lg:hidden">Auditor Portal</h1>
                    </div>
                    <div>
                        <NotificationBell />
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
