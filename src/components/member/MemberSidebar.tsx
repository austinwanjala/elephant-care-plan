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
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-lg font-serif font-bold text-foreground">{settings.app_name || "Elephant Dental"}</span>
              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Member</span>
            </div>
          )}
        </div>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>My Account</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                  className="h-11 transition-all duration-300"
                >
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }}
                    className="flex items-center gap-3"
                  >
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300",
                      isActive(item.url)
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      "font-medium transition-colors duration-300",
                      isActive(item.url) ? "text-primary font-bold" : "text-slate-600"
                    )}>{item.title}</span>
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