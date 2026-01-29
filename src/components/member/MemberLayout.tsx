import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MemberSidebar } from "./MemberSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface MemberLayoutProps {
  children?: ReactNode; // Children is optional when using Outlet
}

interface MemberInfo {
  full_name: string;
}

export function MemberLayout({ children }: MemberLayoutProps) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
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
      .maybeSingle();

    if (roleData?.role !== "member" && roleData?.role !== "admin") {
      toast({
        title: "Access denied",
        description: "You don't have member privileges",
        variant: "destructive",
      });
      // Redirect to appropriate dashboard if not a member but has other roles
      if (roleData?.role === "staff") {
        navigate("/staff");
      } else if (roleData?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/"); // Fallback to home
      }
      return;
    }

    // Fetch member details
    const { data: memberDetails, error: memberError } = await supabase
      .from("members")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      toast({
        title: "Error loading member details",
        description: memberError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setMemberInfo(memberDetails);
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
        <MemberSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
            <SidebarTrigger className="mr-4" />
            {memberInfo && memberInfo.full_name && (
              <span className="text-muted-foreground text-sm sm:text-base">
                Welcome, <span className="font-semibold text-foreground">{memberInfo.full_name}</span>
              </span>
            )}
          </header>
          <main className="p-6">
            {children || <Outlet />} {/* Render children or nested routes */}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}