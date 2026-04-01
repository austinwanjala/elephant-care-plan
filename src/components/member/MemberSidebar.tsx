import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  History,
  UserCog,
  LogOut,
  UserPlus,
  CalendarClock,
  KeyRound,
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

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Wallet", url: "/dashboard/payments", icon: Wallet },
  { title: "Visit History", url: "/dashboard/visits", icon: History },
  { title: "Book Appointment", url: "/dashboard/appointments", icon: CalendarClock },
  { title: "My Dependants", url: "/dashboard/dependants", icon: UserPlus },
  { title: "Profile Settings", url: "/dashboard/profile", icon: UserCog },
  { title: "Change Password", url: "/dashboard/change-password", icon: KeyRound },
];

import { useSystemSettings } from "@/hooks/useSystemSettings";

export function MemberSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSystemSettings();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
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
            collapsed ? "p-1.5 h-10 w-10 shadow-none border-transparent" : "p-2.5 h-16 w-16 shadow-xl shadow-blue-500/10"
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
              <div className="flex items-center gap-2 mt-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full w-fit shadow-lg shadow-blue-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
                  Member Portal
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">My Account</SidebarGroupLabel>
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
                      ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400" 
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
                        isActive(item.url) ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-300"
                      )} />
                    </div>
                    <span className={cn(
                      "font-semibold text-sm tracking-tight transition-all duration-300",
                      isActive(item.url) ? "opacity-100" : "opacity-80 group-hover/btn:opacity-100"
                    )}>{item.title}</span>
                    
                    {isActive(item.url) && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
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
