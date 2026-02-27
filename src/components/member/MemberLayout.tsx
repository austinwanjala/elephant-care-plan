import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { NotificationBell } from "../notifications/NotificationBell";
import { MemberSidebar } from "./MemberSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface MemberLayoutProps {
  children?: ReactNode;
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
    checkAuthAndMaintenance();

    const channel = supabase
      .channel('maintenance_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.maintenance_mode'
        },
        () => checkAuthAndMaintenance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuthAndMaintenance = async () => {
    setLoading(true);

    const { data: maintenanceData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();

    const isMaintenance = maintenanceData?.value === "true";

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      setLoading(false);
      return;
    }

    // Role (self-heal if missing)
    let role = (await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()).data?.role as string | undefined;

    if (!role) {
      await supabase.rpc("ensure_portal_role");
      role = (await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()).data?.role as string | undefined;
    }

    // Maintenance redirect for non-admins
    if (isMaintenance && role !== "admin" && role !== "super_admin") {
      navigate("/maintenance");
      setLoading(false);
      return;
    }

    // Role-based redirects for non-members
    if (role === "receptionist") { navigate("/reception"); setLoading(false); return; }
    if (role === "doctor") { navigate("/doctor"); setLoading(false); return; }
    if (role === "branch_director") { navigate("/director"); setLoading(false); return; }
    if (role === "marketer") { navigate("/marketer"); setLoading(false); return; }
    if (role === "finance") { navigate("/finance"); setLoading(false); return; }
    if (role === "auditor") { navigate("/auditor"); setLoading(false); return; }

    // Ensure member profile exists (fixes "You don't have member privileges")
    let memberDetails = (await supabase
      .from("members")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()).data as MemberInfo | null;

    if (!memberDetails) {
      await supabase.rpc("ensure_member_profile");
      memberDetails = (await supabase
        .from("members")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle()).data as MemberInfo | null;
    }

    // Ensure dependants created during signup are persisted
    await supabase.rpc("ensure_member_dependants_from_metadata");

    if (!memberDetails) {
      toast({ title: "Access denied", description: "You don't have member privileges", variant: "destructive" });
      navigate("/");
      setLoading(false);
      return;
    }

    setMemberInfo(memberDetails);
    setAuthorized(true);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!authorized) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <MemberSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background/95 backdrop-blur z-40">
            <SidebarTrigger className="mr-4" />
            <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
              <NotificationBell />
              <span>Welcome, <span className="font-bold text-slate-800">{loading ? "..." : authorized ? (memberInfo?.full_name || "Member") : ""}</span></span>
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