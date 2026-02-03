import { useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  UserCog,
  FileText, // Removed for claims
  Stethoscope,
  LayoutDashboard,
  LogOut,
  Settings,
  History,
  DollarSign,
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
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Members", url: "/admin/members", icon: Users },
  { title: "Branches", url: "/admin/branches", icon: Building2 },
  { title: "Staff", url: "/admin/staff", icon: UserCog },
  // { title: "Claims", url: "/admin/claims", icon: FileText }, // Removed
  { title: "Visits", url: "/admin/visits", icon: History },
  { title: "Services", url: "/admin/services", icon: Stethoscope },
  { title: "Branch Payments", url: "/admin/branch-payments", icon: DollarSign },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
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
              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Admin</span>
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