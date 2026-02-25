import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { NotificationBell } from "../notifications/NotificationBell";
import { FinanceSidebar } from "./FinanceSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

import { useSystemSettings } from "@/hooks/useSystemSettings";

export function FinanceLayout() {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { settings } = useSystemSettings();

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (settings.maintenance_mode === "true" && role !== "admin" && role !== "super_admin") {
            navigate("/maintenance");
        }
    }, [settings.maintenance_mode, role, navigate]);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }

        const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const roles = rolesData?.map(r => r.role) || [];

        const hasFinanceAccess = roles.includes("finance") || roles.includes("super_admin") || roles.includes("admin");
        setRole(roles.includes("super_admin") ? "super_admin" : (roles.includes("admin") ? "admin" : roles[0]));

        if (!hasFinanceAccess) {
            toast({ title: "Access Denied", description: "Finance privileges required.", variant: "destructive" });
            navigate("/");
            return;
        }


        // Fetch Finance Staff Name
        const { data: staffData } = await supabase
            .from("staff")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffData) {
            setUserName(staffData.full_name);
        }

        setAuthorized(true);
        setLoading(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-background">
                <FinanceSidebar />
                <SidebarInset className="flex-1">
                    <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
                        <SidebarTrigger className="mr-4" />
                        <span className="font-bold text-amber-700">Finance Portal</span>
                        <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
                            <NotificationBell />
                            <span>Welcome, <span className="font-bold text-slate-800">{loading ? "..." : authorized ? (userName || "Finance") : ""}</span></span>
                        </div>
                    </header>
                    <main className="p-6"><Outlet /></main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}