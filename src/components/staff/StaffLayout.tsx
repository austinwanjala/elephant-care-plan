import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom"; // Import Outlet
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { StaffSidebar } from "./StaffSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface StaffLayoutProps {
  // children: ReactNode; // No longer needed when using Outlet
}

export function StaffLayout({ /* children */ }: StaffLayoutProps) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle(); // Changed from .single() to .maybeSingle()

    if (roleData?.role !== "staff" && roleData?.role !== "admin") {
      toast({
        title: "Access denied",
        description: "You don't have staff privileges",
        variant: "destructive",
      });
      navigate("/dashboard"); // Redirect to member dashboard if not staff/admin
      return;
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
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <StaffSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
            <SidebarTrigger className="mr-4" />
          </header>
          <main className="p-6">
            <Outlet /> {/* Render nested routes here */}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}