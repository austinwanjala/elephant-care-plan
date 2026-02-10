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
import { Badge } from "@/components/ui/badge";

type AppRole = 'admin' | 'super_admin' | 'receptionist' | 'doctor' | 'finance' | 'auditor' | 'marketer' | 'member' | 'branch_director';

const ROLES: AppRole[] = ['receptionist', 'doctor', 'branch_director', 'finance', 'auditor', 'marketer', 'admin'];

interface Permission {
    id: string;
    resource: string;
    action: string;
    description: string | null;
}

interface RolePermission {
    role: AppRole;
    permission_id: string;
}

export default function AdminPermissions() {
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Requestable Permissions
            const { data: permsData, error: permsError } = await (supabase as any)
                .from("permissions")
                .select("*")
                .order("resource", { ascending: true })
                .order("action", { ascending: true });

            if (permsError) throw permsError;
            setAllPermissions(permsData || []);

            // 2. Fetch Current Assignments
            const { data: rolePermsData, error: rolePermsError } = await (supabase as any)
                .from("role_permissions")
                .select("role, permission_id");

            if (rolePermsError) throw rolePermsError;

            const permMap: Record<string, string[]> = {};
            ROLES.forEach(role => permMap[role] = []);

            rolePermsData?.forEach((rp: any) => {
                if (permMap[rp.role]) {
                    permMap[rp.role].push(rp.permission_id);
                }
            });

            setRolePermissions(permMap);

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
        setRolePermissions(prev => {
            const current = prev[role] || [];
            const exists = current.includes(permissionId);

            let updated;
            if (exists) {
                updated = current.filter(id => id !== permissionId);
            } else {
                updated = [...current, permissionId];
            }

            return { ...prev, [role]: updated };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Delete existing permissions for these roles
            const { error: deleteError } = await (supabase as any)
                .from("role_permissions")
                .delete()
                .in("role", ROLES);

            if (deleteError) throw deleteError;

            // 2. Insert new assignments
            const toInsert: { role: string, permission_id: string }[] = [];
            Object.entries(rolePermissions).forEach(([role, perms]) => {
                if (ROLES.includes(role as AppRole)) {
                    perms.forEach(permId => {
                        toInsert.push({ role, permission_id: permId });
                    });
                }
            });

            if (toInsert.length > 0) {
                const { error: insertError } = await (supabase as any)
                    .from("role_permissions")
                    .insert(toInsert);

                if (insertError) throw insertError;
            }

            toast({
                title: "Permissions saved",
                description: "Role policies have been updated.",
            });

            // Force reload to verify state matches DB
            await loadData();

        } catch (error: any) {
            console.error("Save error:", error);
            toast({
                title: "Error saving changes",
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
                    <p className="text-muted-foreground">Configure detailed access controls per resource.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-primary">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Assignments
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Access Control Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Resource / Action</TableHead>
                                    {ROLES.map(role => (
                                        <TableHead key={role} className="text-center bg-muted/20 min-w-[100px] capitalize">
                                            {role.replace('_', ' ')}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allPermissions.map((perm) => (
                                    <TableRow key={perm.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold capitalize text-foreground">{perm.resource}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-xs font-mono">{perm.action}</Badge>
                                                    <span className="text-xs text-muted-foreground">{perm.description}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {ROLES.map(role => (
                                            <TableCell key={`${role}-${perm.id}`} className="text-center border-l border-border/50">
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        checked={(rolePermissions[role] || []).includes(perm.id)}
                                                        onCheckedChange={() => handleToggle(role, perm.id)}
                                                    />
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100 text-sm text-yellow-800 flex items-start gap-2">
                <div className="mt-0.5">⚠️</div>
                <div>
                    <strong>Super Admin Access:</strong> Super Admins possess a global bypass and are not restricted by this matrix.
                    Changes here affect `admin`, `doctor`, `staff`, etc.
                </div>
            </div>
        </div>
    );
}
