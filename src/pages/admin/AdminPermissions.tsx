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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";

interface Permission {
    id: string;
    resource: string;
    action: string;
    description: string;
}

interface RolePermission {
    role: string;
    permission_id: string;
}

const ROLES = ['admin', 'super_admin', 'doctor', 'receptionist', 'auditor', 'marketer', 'finance', 'branch_director'];

export default function AdminPermissions() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
    const [originalRolePermissions, setOriginalRolePermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Permissions
            const { data: permsData, error: permsError } = await (supabase as any)
                .from("permissions")
                .select("*")
                .order("resource", { ascending: true });

            if (permsError) throw permsError;

            // Fetch Existing Role Assignments
            const { data: rolePermsData, error: rolePermsError } = await (supabase as any)
                .from("role_permissions")
                .select("role, permission_id");

            if (rolePermsError) throw rolePermsError;

            setPermissions(permsData || []);
            setRolePermissions(rolePermsData || []);
            setOriginalRolePermissions(rolePermsData || []);
            setHasChanges(false);

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

    const hasPermission = (role: string, permissionId: string) => {
        return rolePermissions.some(rp => rp.role === role && rp.permission_id === permissionId);
    };

    const togglePermission = (role: string, permissionId: string, checked: boolean) => {
        let newRolePermissions = [...rolePermissions];

        if (checked) {
            if (!hasPermission(role, permissionId)) {
                newRolePermissions.push({ role, permission_id: permissionId });
            }
        } else {
            newRolePermissions = newRolePermissions.filter(rp => !(rp.role === role && rp.permission_id === permissionId));
        }

        setRolePermissions(newRolePermissions);
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Find additions
            const toAdd = rolePermissions.filter(rp =>
                !originalRolePermissions.some(orp => orp.role === rp.role && orp.permission_id === rp.permission_id)
            );

            // 2. Find removals
            const toRemove = originalRolePermissions.filter(orp =>
                !rolePermissions.some(rp => rp.role === orp.role && rp.permission_id === orp.permission_id)
            );

            if (toAdd.length === 0 && toRemove.length === 0) {
                setSaving(false);
                setHasChanges(false);
                return;
            }

            // Execute Updates
            if (toRemove.length > 0) {
                for (const rp of toRemove) {
                    const { error, count } = await (supabase as any)
                        .from("role_permissions")
                        .delete({ count: 'exact' })
                        .match({ role: rp.role, permission_id: rp.permission_id });

                    if (error) {
                        console.error("Delete error:", error);
                        throw error;
                    }
                    if (count === 0) {
                        console.warn("Delete affected 0 rows for:", rp);
                        // RLS might be blocking it, or it doesn't exist
                    } else {
                        console.log("Deleted:", rp);
                    }
                }
            }

            if (toAdd.length > 0) {
                const { error } = await (supabase as any).from("role_permissions").insert(toAdd);
                if (error) {
                    console.error("Insert error:", error);
                    throw error;
                }
                console.log("Inserted:", toAdd.length);
            }

            toast({ title: "Permissions Updated", description: `Saved: -${toRemove.length} / +${toAdd.length} permissions.` });

            // Refresh state
            // Re-fetch to be sure
            await loadData();

        } catch (error: any) {
            console.error("Save failed:", error);
            toast({ title: "Save failed", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    // Group permissions by resource for better UI
    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.resource]) acc[perm.resource] = [];
        acc[perm.resource].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Role Permissions</h1>
                    <p className="text-muted-foreground">Manage access controls for each user role.</p>
                </div>
                <Button onClick={handleSave} disabled={!hasChanges || saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5" />
                        Permissions Matrix
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Permission</TableHead>
                                    {ROLES.map(role => (
                                        <TableHead key={role} className="text-center capitalize px-2 min-w-[80px]">
                                            <Badge variant="outline">{role.replace('_', ' ')}</Badge>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                                    <>
                                        <TableRow key={`header-${resource}`} className="bg-muted/50">
                                            <TableCell colSpan={ROLES.length + 1} className="font-semibold capitalize py-2">
                                                {resource} Management
                                            </TableCell>
                                        </TableRow>
                                        {perms.map(perm => (
                                            <TableRow key={perm.id}>
                                                <TableCell>
                                                    <div className="font-medium">{perm.action}</div>
                                                    <div className="text-xs text-muted-foreground">{perm.description}</div>
                                                </TableCell>
                                                {ROLES.map(role => (
                                                    <TableCell key={`${role}-${perm.id}`} className="text-center">
                                                        <Checkbox
                                                            checked={hasPermission(role, perm.id)}
                                                            onCheckedChange={(checked) => togglePermission(role, perm.id, checked as boolean)}
                                                            disabled={role === 'super_admin'} // Prevent locking out super admin
                                                            className="mx-auto"
                                                        />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
