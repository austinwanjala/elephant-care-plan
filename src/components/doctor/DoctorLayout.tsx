import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { NotificationBell } from "../notifications/NotificationBell";
import { DoctorSidebar } from "./DoctorSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface DoctorLayoutProps {
    children?: ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true); // Ensure loading starts
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            setLoading(false); // IMPORTANT: Set loading to false here
            return;
        }

        const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

        if (roleError) {
            toast({
                title: "Error fetching role",
                description: roleError.message,
                variant: "destructive",
            });
            navigate("/");
            setLoading(false);
            return;
        }

        // @ts-ignore
        if (roleData?.role !== "doctor" && roleData?.role !== "admin") {
            toast({
                title: "Access Denied",
                description: "You must be a doctor to view this page.",
                variant: "destructive",
            });
            navigate("/");
            setLoading(false);
            return;
        }

        // Fetch Doctor Name
        const { data: staffData } = await supabase
            .from("staff")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffData) {
            setUserName(staffData.full_name);
        } else {
            // Fallback to doctors table if migration not fully done
            const { data: doctorData } = await supabase
                .from("doctors")
                .select("full_name")
                .eq("user_id", user.id)
                .maybeSingle();
            if (doctorData) setUserName(doctorData.full_name);
        }

        setAuthorized(true);
        setLoading(false);
        return;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!authorized) return null;

    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-background">
                <DoctorSidebar />
                <SidebarInset className="flex-1">
                    <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
                        <SidebarTrigger className="mr-4" />
                        <span className="font-semibold text-blue-700">Doctor Portal</span>
                        <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
                            <NotificationBell />
                            <span>Welcome, <span className="font-bold text-slate-800">{loading ? "..." : authorized ? (userName || "Doctor") : ""}</span></span>
                        </div>
                    </header>
                    <main className="p-6">
                        {children || <Outlet />}
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}