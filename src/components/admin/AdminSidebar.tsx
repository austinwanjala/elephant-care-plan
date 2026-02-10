import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Users,
  Building2,
  UserCog,
  Stethoscope,
  LayoutDashboard,
  LogOut,
  Settings,
  History,
  DollarSign,
  ClipboardList,
  FileText,
  ShieldAlert,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { usePermissions } from "@/hooks/usePermissions";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [basePath, setBasePath] = useState("/admin");
  const [roleLabel, setRoleLabel] = useState("Admin");
  const { hasPermission, loading: permsLoading } = usePermissions();

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
        if ((data?.role as string) === 'super_admin') {
          setBasePath("/super-admin");
          setRoleLabel("Super Admin");
        } else {
          setBasePath("/admin");
          setRoleLabel("Admin");
        }
      }
    };
    checkRole();
  }, []);

  const menuItems = [
    { title: "Dashboard", url: basePath, icon: LayoutDashboard },
    { title: "Members", url: `${basePath}/members`, icon: Users },
    { title: "Branches", url: `${basePath}/branches`, icon: Building2 },
    { title: "Staff", url: `${basePath}/staff`, icon: UserCog },
    { title: "Visits", url: `${basePath}/visits`, icon: History },
    { title: "Services", url: `${basePath}/services`, icon: Stethoscope },
    { title: "Branch Payments", url: `${basePath}/branch-payments`, icon: DollarSign },
    { title: "Marketer Claims", url: `${basePath}/marketer-claims`, icon: ClipboardList },
  ];

  // Conditionally add System Logs
  if (hasPermission('audit_logs', 'view') || roleLabel === 'Super Admin') {
    menuItems.push({ title: "System Logs", url: `${basePath}/logs`, icon: FileText });
  }

  const settingsMenuItems = [
    { title: "General Settings", url: `${basePath}/settings`, icon: Settings },
    { title: "Membership Categories", url: `${basePath}/membership-categories`, icon: Users },
    { title: "Commission Rates", url: `${basePath}/commission-settings`, icon: DollarSign },
  ];

  if (roleLabel === "Super Admin") {
    settingsMenuItems.push({ title: "Permissions", url: `${basePath}/permissions`, icon: ShieldAlert });
  }

  useEffect(() => {
    const fetchPendingClaims = async () => {
      const { count } = await (supabase as any)
        .from('marketer_claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingClaimsCount(count || 0);
    };

    fetchPendingClaims();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketer_claims'
        },
        () => {
          fetchPendingClaims();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === basePath) {
      return location.pathname === basePath;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-xl">🐘</span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-lg font-serif font-bold text-foreground">Elephant Dental</span>
              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{roleLabel}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                >
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }}
                    className="flex items-center gap-3 justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </div>
                    {item.title === "Marketer Claims" && pendingClaimsCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                        {pendingClaimsCount}
                      </span>
                    )}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarMenu>
            {settingsMenuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                >
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }}
                    className="flex items-center gap-3"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}