import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const PermissionWatcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    let channel: any;

    const setupWatcher = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Initial check and subscription to staff table
      channel = supabase
        .channel(`public:staff:user_id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'staff',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newRole = payload.new.role;
            const isActive = payload.new.is_active;

            // If account is deactivated
            if (isActive === false) {
              toast({
                title: "Access Revoked",
                description: "Your account has been deactivated by an administrator.",
                variant: "destructive",
              });
              supabase.auth.signOut();
              navigate("/login");
              return;
            }

            // Check if the new role matches the current route prefix
            const path = location.pathname;
            const rolePrefixMap: Record<string, string> = {
              'admin': '/admin',
              'receptionist': '/reception',
              'doctor': '/doctor',
              'director': '/director',
              'marketer': '/marketer',
              'auditor': '/auditor',
              'finance': '/finance'
            };

            const expectedPrefix = rolePrefixMap[newRole];
            if (expectedPrefix && !path.startsWith(expectedPrefix) && path !== '/' && !path.startsWith('/login')) {
              toast({
                title: "Permissions Updated",
                description: `Your role has been changed to ${newRole}. Redirecting...`,
              });
              // Redirect to their new appropriate dashboard
              navigate(expectedPrefix);
            }
          }
        )
        .subscribe();
    };

    setupWatcher();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [navigate, location.pathname, toast]);

  return null; // This is a headless logic component
};