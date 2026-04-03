import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  Users,
  Building2,
  UserCog,
  Stethoscope,
  LayoutDashboard,
  LogOut,
  Settings,
  ClipboardList,
  History,
  DollarSign,
  Landmark,
  BadgePercent,
  Receipt,
  Banknote,
  FileText,
  Activity,
  BarChart3,
  Bell,
  MessageSquare,
  ShieldAlert,
  Fingerprint,
  CalendarDays,
  CalendarCheck,
  Bookmark,
  Percent,
  Send,
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

import { useSystemSettings } from "@/hooks/useSystemSettings";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [basePath, setBasePath] = useState("/admin");
  const [roleLabel, setRoleLabel] = useState("Admin");
  const { hasPermission, loading: permsLoading } = usePermissions();
  const { settings } = useSystemSettings();

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
    { title: "Partners", url: `${basePath}/marketers`, icon: Users },
    { title: "Visits", url: `${basePath}/visits`, icon: ClipboardList },
    { title: "Appointments", url: `${basePath}/appointments`, icon: CalendarDays },
    { title: "Services", url: `${basePath}/services`, icon: Stethoscope },
    { title: "Branch Payments", url: `${basePath}/branch-payments`, icon: Landmark },
    { title: "Branch Fines", url: `${basePath}/branch-fines`, icon: ShieldAlert },
    { title: "Marketer Commissions", url: `${basePath}/marketer-commissions`, icon: BadgePercent },
    { title: "Marketer Claims", url: `${basePath}/marketer-claims`, icon: Receipt },
    { title: "Payments", url: `${basePath}/payments`, icon: Banknote },
    { title: "Messages", url: `${basePath}/messages`, icon: MessageSquare },
  ];

  // Conditionally add System Logs
  if (hasPermission('system_logs', 'view')) {
    menuItems.push({ title: "System Logs", url: `${basePath}/logs`, icon: Activity });
  }

  // Add Reports for admins
  menuItems.push({ title: "Reports", url: `${basePath}/reports`, icon: BarChart3 });

  // Add Notifications for admins
  menuItems.push({ title: "Notifications", url: `${basePath}/notifications`, icon: Bell });

  const settingsMenuItems = [
    { title: "General Settings", url: `${basePath}/settings`, icon: Settings },
    { title: "Appointment Settings", url: `${basePath}/appointment-settings`, icon: CalendarCheck },
    { title: "Membership Categories", url: `${basePath}/membership-categories`, icon: Bookmark },
    { title: "Commission Rates", url: `${basePath}/commission-settings`, icon: Percent },
    { title: "WhatsApp Config", url: `${basePath}/whatsapp`, icon: Send },
  ];

  if (roleLabel === "Super Admin") {
    settingsMenuItems.push({ title: "Permissions", url: `${basePath}/permissions`, icon: ShieldAlert });
    settingsMenuItems.push({ title: "Content Management", url: `${basePath}/content`, icon: FileText });
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
    <Sidebar collapsible="icon" className="border-r border-border/60 transition-all duration-500">
      <SidebarHeader className="p-4 border-b border-border/40 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
        <div className={cn("flex items-center transition-all duration-500", collapsed ? "justify-center gap-0" : "gap-4")}>
          <div className={cn(
            "flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl transform transition-all duration-500",
            collapsed ? "p-1.5 h-10 w-10 shadow-none border-transparent" : "p-2.5 h-16 w-16 shadow-xl shadow-primary/10"
          )}>
            <img 
              src="/img/elephantlogo.jpg" 
              alt="Elephant Logo" 
              className={cn(
                "w-auto object-contain rounded-xl transition-all duration-500", 
                collapsed ? "h-7" : "h-12"
              )} 
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-700">
              <span className="text-xl font-serif font-black text-slate-900 dark:text-white leading-[1.1] truncate tracking-tight">
                {settings.app_name || "Elephant Dental"}
              </span>
              <div className={cn(
                "flex items-center gap-2 mt-1.5 px-3 py-1 rounded-full w-fit shadow-lg shadow-primary/20",
                roleLabel === "Super Admin" ? "bg-gradient-to-r from-indigo-600 to-violet-600" : "bg-gradient-to-r from-blue-600 to-indigo-600"
              )}>
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
                  {roleLabel}
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu className="gap-2 px-2">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                  className={cn(
                    "h-12 w-full transition-all duration-300 rounded-xl group/btn relative overflow-hidden",
                    isActive(item.url)
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }}
                    className="flex items-center gap-3 w-full px-3"
                  >
                    <div className={cn(
                      "flex items-center justify-center transition-all duration-300",
                      isActive(item.url) ? "transform scale-110" : "group-hover/btn:scale-110"
                    )}>
                      <item.icon className={cn(
                        "h-5 w-5 transition-colors duration-300",
                        isActive(item.url) ? "text-primary" : "text-slate-600 dark:text-slate-300 group-hover/btn:text-primary"
                      )} />
                    </div>
                    <span className={cn(
                      "font-semibold text-sm tracking-tight transition-all duration-300",
                      isActive(item.url) ? "opacity-100" : "opacity-80 group-hover/btn:opacity-100"
                    )}>{item.title}</span>

                    {/* Professional Active Indicator */}
                    {isActive(item.url) && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full animate-in slide-in-from-left-full duration-500" />
                    )}

                    {item.title === "Marketer Claims" && pendingClaimsCount > 0 && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-lg shadow-red-500/30">
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
          <SidebarMenu className="gap-2 px-2">
            {settingsMenuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                  className={cn(
                    "h-12 w-full transition-all duration-300 rounded-xl group/btn relative overflow-hidden",
                    isActive(item.url)
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }}
                    className="flex items-center gap-3 w-full px-3"
                  >
                    <div className={cn(
                      "flex items-center justify-center transition-all duration-300",
                      isActive(item.url) ? "transform scale-110" : "group-hover/btn:scale-110"
                    )}>
                      <item.icon className={cn(
                        "h-5 w-5 transition-colors duration-300",
                        isActive(item.url) ? "text-primary" : "text-slate-600 dark:text-slate-300 group-hover/btn:text-primary"
                      )} />
                    </div>
                    <span className={cn(
                      "font-semibold text-sm tracking-tight transition-all duration-300",
                      isActive(item.url) ? "opacity-100" : "opacity-80 group-hover/btn:opacity-100"
                    )}>{item.title}</span>

                    {/* Professional Active Indicator */}
                    {isActive(item.url) && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full animate-in slide-in-from-left-full duration-500" />
                    )}
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
