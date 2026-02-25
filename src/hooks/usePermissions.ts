import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'process';
export type PermissionResource =
    | 'dashboard'
    | 'members'
    | 'staff'
    | 'branches'
    | 'visits'
    | 'financials'
    | 'system_logs'
    | 'audit_logs'
    | 'settings';

export function usePermissions() {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchPermissions = async () => {
            try {
                // console.log("Fetching permissions...");
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    if (mounted) {
                        setPermissions([]);
                        setRole(null);
                        setLoading(false);
                    }
                    return;
                }

                // 1. Get User Role
                const { data: rolesData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id);

                const roles = rolesData?.map(r => r.role) || [];
                const userRole = roles.includes('super_admin') ? 'super_admin' : (roles.includes('admin') ? 'admin' : (roles.length > 0 ? roles[0] : null));

                if (mounted) setRole(userRole);

                if (userRole === 'super_admin') {
                    if (mounted) {
                        setPermissions(['*']); // Wildcard for everything
                        setLoading(false);
                    }
                    return;
                }

                if (!userRole) {
                    if (mounted) {
                        setPermissions([]);
                        setLoading(false);
                    }
                    return;
                }

                // 2. Get Permissions for Role
                const { data: permData, error } = await supabase
                    .from('role_permissions')
                    .select(`
            permission_id,
            permissions (
              resource,
              action
            )
          `)
                    .eq('role', userRole);

                if (error) {
                    console.error("Error fetching permissions:", error);
                    if (mounted) setLoading(false);
                    return;
                }

                const mappedPerms = permData.map((p: any) => {
                    return `${p.permissions.resource}.${p.permissions.action}`;
                });

                if (mounted) {
                    // console.log("Permissions fetched:", mappedPerms);
                    setPermissions(mappedPerms);
                    setLoading(false);
                }

            } catch (err) {
                console.error("usePermissions error:", err);
                if (mounted) setLoading(false);
            }
        };

        fetchPermissions();

        // Subscribe to changes in role_permissions to auto-refresh
        const channel = supabase
            .channel('public:role_permissions_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'role_permissions' },
                (payload) => {
                    console.log("Permission change detected:", payload);
                    fetchPermissions();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Subscribed to permission changes');
                }
            });

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    const hasPermission = (resource: PermissionResource, action: PermissionAction) => {
        if (loading) return false;
        if (role === 'super_admin') return true;
        if (permissions.includes('*')) return true;
        return permissions.includes(`${resource}.${action}`);
    };

    return { permissions, role, loading, hasPermission };
}
