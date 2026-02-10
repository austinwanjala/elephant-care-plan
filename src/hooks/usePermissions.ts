import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePermissions() {
    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Get User Role
            const { data: roleData } = await (supabase as any)
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!roleData) {
                setLoading(false);
                return;
            }

            // 2. Get Permissions for Role
            const { data: permData } = await (supabase as any)
                .from('role_permissions')
                .select('permissions(resource, action)')
                .eq('role', roleData.role);

            if (permData) {
                const uniquePerms = new Set<string>();
                permData.forEach((rp: any) => {
                    if (rp.permissions) {
                        uniquePerms.add(`${rp.permissions.resource}.${rp.permissions.action}`);
                    }
                });
                setPermissions(uniquePerms);
            }
            setLoading(false);
        };

        fetchPermissions();
    }, []);

    const hasPermission = (resource: string, action: string) => {
        if (loading) return false; // Fail safe
        return permissions.has(`${resource}.${action}`);
    };

    return { hasPermission, loading };
}
