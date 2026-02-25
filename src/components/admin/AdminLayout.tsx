import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { NotificationBell } from "../notifications/NotificationBell";
import PortalMessages from "../PortalMessages";

interface AdminLayoutProps {
  children?: ReactNode; // Made optional as Outlet will be used for nested routes
}

export function AdminLayout({ children }: AdminLayoutProps) {
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

    const { data: rolesData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = rolesData?.map(r => r.role) || [];
    const hasAdminAccess = roles.includes("admin") || roles.includes("super_admin");

    if (roleError) {
      toast({
        title: "Error fetching role",
        description: roleError.message,
        variant: "destructive",
      });
      navigate("/"); // Redirect on error
      setLoading(false);
      return;
    }

    if (!hasAdminAccess) {
      toast({
        title: "Access denied",
        description: "You don't have admin privileges",
        variant: "destructive",
      });
      navigate("/dashboard"); // Redirect to a non-admin dashboard or home
      setLoading(false);
      return;
    }

    // Fetch Admin Name (likely from staff)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return null; // Should have been redirected by checkAuth if not authorized
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
            <SidebarTrigger className="mr-4" />
            <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
              <NotificationBell />
              <span>Welcome, <span className="font-bold text-slate-800">{loading ? "..." : authorized ? (userName || "Admin") : ""}</span></span>
            </div>
          </header>
          <main className="p-6">
            {children || <Outlet />} {/* Render children or nested routes */}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}