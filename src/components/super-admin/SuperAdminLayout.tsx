import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "../admin/AdminSidebar"; // Reusing Admin sidebar for now
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import { NotificationBell } from "../notifications/NotificationBell";

export function SuperAdminLayout() {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }

        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();

        if (roleData?.role !== "super_admin") {
            toast({ title: "Access Denied", description: "Super Admin privileges required.", variant: "destructive" });
            navigate("/");
            return;
        }

        // Fetch Super Admin Name
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
                <AdminSidebar />
                <SidebarInset className="flex-1">
                    <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
                        <SidebarTrigger className="mr-4" />
                        <ShieldAlert className="h-5 w-5 text-red-600 mr-2" />
                        <span className="font-bold text-red-700">Super Admin Control</span>
                        <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
                            <NotificationBell />
                            <span>Welcome, <span className="font-bold text-slate-800">{loading ? "..." : authorized ? (userName || "Super Admin") : ""}</span></span>
                        </div>
                    </header>
                    <main className="p-6"><Outlet /></main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}