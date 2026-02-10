import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AppRole = 'admin' | 'super_admin' | 'receptionist' | 'doctor' | 'finance' | 'auditor' | 'marketer' | 'member' | 'branch_director';

const ROLES: AppRole[] = ['receptionist', 'doctor', 'branch_director', 'finance', 'auditor', 'marketer', 'admin'];

const PERMISSIONS = [
    { id: 'view_dashboard', label: 'View Dashboard' },
    { id: 'manage_members', label: 'Manage Members' },
    { id: 'manage_staff', label: 'Manage Staff' },
    { id: 'manage_finance', label: 'Manage Finance' },
    { id: 'view_logs', label: 'View System Logs' },
    { id: 'manage_visits', label: 'Manage Visits' },
    { id: 'manage_settings', label: 'Manage Settings' },
];

export default function AdminPermissions() {
    const [permissions, setPermissions] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase as any).from("role_permissions").select("*");

            if (error) throw error;

            const permMap: Record<string, string[]> = {};

            // Initialize with empty arrays
            ROLES.forEach(role => {
                permMap[role] = [];
            });

            // Fill from DB
            data?.forEach((p: any) => {
                if (!permMap[p.role]) permMap[p.role] = [];
                permMap[p.role].push(p.permission);
            });

            setPermissions(permMap);
        } catch (error: any) {
            toast({
                title: "Error loading permissions",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (role: string, permissionId: string) => {
        setPermissions(prev => {
            const rolePerms = prev[role] || [];
            const hasPerm = rolePerms.includes(permissionId);

            let newRolePerms;
            if (hasPerm) {
                newRolePerms = rolePerms.filter(p => p !== permissionId);
            } else {
                newRolePerms = [...rolePerms, permissionId];
            }

            return {
                ...prev,
                [role]: newRolePerms
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Delete all current permissions for managed roles
            // Note: In a real app with high concurrency this might need a transaction or different strategy,
            // but for this admin tool it's acceptable.
            const { error: deleteError } = await (supabase as any)
                .from("role_permissions")
                .delete()
                .in("role", ROLES);

            if (deleteError) throw deleteError;

            // 2. Insert new permissions
            const toInsert: { role: AppRole, permission: string }[] = [];

            Object.entries(permissions).forEach(([role, perms]) => {
                perms.forEach(perm => {
                    // Ensure role is a valid AppRole to satisfy TS if needed, or just string insert
                    if (ROLES.includes(role as AppRole)) {
                        toInsert.push({ role: role as AppRole, permission: perm });
                    }
                });
            });

            if (toInsert.length > 0) {
                const { error: insertError } = await (supabase as any)
                    .from("role_permissions")
                    .insert(toInsert);

                if (insertError) throw insertError;
            }

            toast({
                title: "Permissions saved",
                description: "Role permissions have been updated successfully.",
            });

        } catch (error: any) {
            toast({
                title: "Error saving permissions",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Role Permissions</h1>
                    <p className="text-muted-foreground">Configure access capabilities for each system role</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-primary">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Permission Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Permission / Role</TableHead>
                                    {ROLES.map(role => (
                                        <TableHead key={role} className="text-center capitalize">{role.replace('_', ' ')}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {PERMISSIONS.map(perm => (
                                    <TableRow key={perm.id}>
                                        <TableCell className="font-medium">{perm.label}</TableCell>
                                        {ROLES.map(role => (
                                            <TableCell key={`${role}-${perm.id}`} className="text-center">
                                                <Checkbox
                                                    checked={(permissions[role] || []).includes(perm.id)}
                                                    onCheckedChange={() => handleToggle(role, perm.id)}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                <p><strong>Note:</strong> Super Admin has implicit full access to all modules and does not need configuration here.</p>
            </div>
        </div>
    );
}
