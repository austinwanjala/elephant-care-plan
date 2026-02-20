import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Download, Loader2, Edit, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";

export default function AdminStaff() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    branchId: "",
    role: "receptionist",
    marketerCode: ""
  });
  const { toast } = useToast();

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
    fetchCurrentUserRole();
  }, []);

  const [currentUserBranchId, setCurrentUserBranchId] = useState<string | null>(null);

  const fetchCurrentUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const role = data?.role || null;
      setCurrentUserRole(role);

      if (role === 'branch_director') {
        const { data: staffData } = await supabase.from("staff").select("branch_id").eq("user_id", user.id).single();
        if (staffData) setCurrentUserBranchId(staffData.branch_id);
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffRes, marketersRes, rolesRes, branchesRes] = await Promise.all([
        supabase.from("staff").select("*, branches(name)").order("created_at", { ascending: false }),
        supabase.from("marketers").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("branches").select("id, name").eq("is_active", true),
      ]);

      const roleMap: Record<string, string> = {};
      (rolesRes.data || []).forEach((r: any) => {
        roleMap[r.user_id] = r.role;
      });

      const combined = [
        ...(staffRes.data || []).map((s: any) => ({
          ...s,
          displayRole: roleMap[s.user_id] || 'staff',
          type: 'staff'
        })),
        ...(marketersRes.data || []).map((m: any) => ({
          ...m,
          displayRole: 'marketer',
          branches: { name: 'N/A (Marketer)' },
          type: 'marketer'
        }))
      ];

      setUsers(combined);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (error: any) {
      toast({ title: "Error loading data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser({
      ...user,
      branchId: user.branch_id,
      role: user.displayRole // Load current role
    });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    setLoading(true);
    try {
      const table = editingUser.type === 'marketer' ? 'marketers' : 'staff';
      const updates: any = {
        full_name: editingUser.full_name,
        phone: editingUser.phone,
      };

      if (editingUser.type !== 'marketer') {
        updates.branch_id = editingUser.branchId;
      }

      // 1. Update Profile/Staff details
      const { error } = await supabase.from(table).update(updates).eq("user_id", editingUser.user_id);
      if (error) throw error;

      // 2. Update Role if changed
      if (editingUser.role !== editingUser.displayRole) {
        const { error: roleError } = await supabase.rpc('update_staff_role', {
          target_user_id: editingUser.user_id,
          new_role: editingUser.role
        });
        if (roleError) throw roleError;
      }

      toast({ title: "User updated", description: "The user details and role have been updated." });
      setEditDialogOpen(false);
      setEditingUser(null);
      loadData();
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  setEditDialogOpen(false);
  setEditingUser(null);
  loadData();
} catch (error: any) {
  toast({ title: "Update failed", description: error.message, variant: "destructive" });
} finally {
  setLoading(false);
}
  };

const handleAddUser = async () => {
  setLoading(true);
  try {
    if (!formData.email || !formData.password || !formData.fullName) {
      throw new Error("Email, Password and Full Name are required.");
    }

    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: formData.email,
        password: formData.password,
        metadata: {
          role: formData.role,
          full_name: formData.fullName,
          phone: formData.phone || null,
          id_number: `STAFF-${Date.now()}`,
          age: 30,
          branch_id: (currentUserRole === 'branch_director' ? currentUserBranchId : formData.branchId) || null,
          marketer_code: formData.marketerCode || null
        }
      }
    });

    if (error) {
      const errorData = await error.context?.json().catch(() => ({}));
      throw new Error(errorData?.error || error.message);
    }

    toast({
      title: "Account Created",
      description: `${formData.fullName} has been added as ${formData.role}.`
    });

    setDialogOpen(false);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      branchId: currentUserRole === 'branch_director' ? (currentUserBranchId || "") : "",
      role: "receptionist",
      marketerCode: ""
    });
    loadData();

  } catch (error: any) {
    toast({ title: "Creation failed", description: error.message, variant: "destructive" });
  } finally {
    setLoading(false);
  }
};

const handleDelete = async (userId: string) => {
  if (!confirm("Are you sure? This will permanently delete the user account and all associated records.")) return;
  setLoading(true);
  try {
    const { error } = await supabase.functions.invoke("admin-delete-user", {
      body: { userId }
    });
    if (error) throw error;

    toast({ title: "User Deleted", description: "The account has been permanently removed." });
    loadData();
  } catch (error: any) {
    toast({ title: "Error deleting", description: error.message, variant: "destructive" });
  } finally {
    setLoading(false);
  }
};

const handleToggleActive = async (userId: string, type: string, currentStatus: boolean) => {
  try {
    const table = type === 'marketer' ? 'marketers' : 'staff';
    const { error } = await supabase.from(table).update({ is_active: !currentStatus }).eq("user_id", userId);
    if (error) throw error;
    loadData();
  } catch (error: any) {
    toast({ title: "Status toggle failed", description: error.message, variant: "destructive" });
  }
};

const handleExport = () => {
  const dataToExport = filteredUsers.map(u => ({
    "Full Name": u.full_name,
    "Email": u.email || "",
    "Phone": u.phone || "",
    "Role": u.displayRole.replace('_', ' '),
    "Branch/Code": u.type === 'marketer' ? `Code: ${u.code}` : (u.branches?.name || 'Unassigned'),
    "Status": u.is_active ? "Active" : "Paused"
  }));
  exportToCsv("staff_export.csv", dataToExport);
};

const isSuperAdmin = currentUserRole === 'super_admin';

// Filter out Super Admins if the current user is just an Admin
// Filter out Super Admins if the current user is just an Admin
// If Branch Director, only show staff from their branch
const filteredUsers = users.filter(u => {
  if (currentUserRole === 'branch_director') {
    // Directors can't see Super Admins or Admins or Auditors
    if (['super_admin', 'admin', 'auditor'].includes(u.displayRole)) return false;
    // Marketers are shared/global? Or per branch? 
    // Marketers don't have branch_id usually, so maybe show all or none? 
    // User request: "create staff that is (doctors, marketers, and receiptionists)"
    // So they should see marketers. 
    // But for staff (doctors/receptionists), check branch.
    if (u.type === 'staff' && u.branch_id !== currentUserBranchId) return false;
    return true;
  }
  if (isSuperAdmin) return true;
  return u.displayRole !== 'super_admin';
});

return (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between gap-4">
      <div>
        <h1 className="text-3xl font-serif font-bold text-blue-900">Staff & Management</h1>
        <p className="text-muted-foreground">Manage Doctors, Receptionists, Directors, and Marketers</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Create Portal Access</DialogTitle>
              <DialogDescription>All fields marked with * are required.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0712 345 678" />
              </div>
              <div className="space-y-2">
                <Label>Target Portal Role *</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    {(isSuperAdmin || currentUserRole === 'admin') && <SelectItem value="branch_director">Branch Director</SelectItem>}
                    <SelectItem value="marketer">Marketer</SelectItem>
                    <SelectItem value="finance">Finance Officer</SelectItem>
                    {isSuperAdmin && <SelectItem value="auditor">Auditor</SelectItem>}
                    {isSuperAdmin && <SelectItem value="admin">Administrator</SelectItem>}
                    {isSuperAdmin && <SelectItem value="super_admin">Super Administrator</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {formData.role !== 'marketer' && formData.role !== 'admin' && formData.role !== 'super_admin' && formData.role !== 'finance' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Assigned Branch</Label>
                  <Select
                    value={currentUserRole === 'branch_director' ? currentUserBranchId : formData.branchId}
                    onValueChange={(v) => setFormData({ ...formData, branchId: v })}
                    disabled={currentUserRole === 'branch_director'}
                  >
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.role === 'marketer' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Marketer Referral Code (Optional)</Label>
                  <Input value={formData.marketerCode} onChange={(e) => setFormData({ ...formData, marketerCode: e.target.value })} placeholder="e.g. AGENT001" />
                </div>
              )}
              <Button onClick={handleAddUser} className="bg-blue-600 hover:bg-blue-700 mt-2 w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account & Profile"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Edit User Details</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editingUser.full_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  />
                </div>
                {editingUser.type !== 'marketer' && editingUser.displayRole !== 'admin' && editingUser.displayRole !== 'super_admin' && (
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select
                      value={editingUser.branchId || ''}
                      onValueChange={(v) => setEditingUser({ ...editingUser, branchId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleUpdateUser} className="bg-blue-600 hover:bg-blue-700 mt-2 w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Card className="shadow-sm border-blue-50 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch / Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Refreshing staff records...</TableCell></TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No staff members found. Create your first portal user above.</TableCell></TableRow>
            ) : (
              filteredUsers.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {u.full_name}
                      {u.displayRole === 'super_admin' && <ShieldAlert className="h-3 w-3 text-red-600" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email || u.phone}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${u.displayRole === 'super_admin' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {u.displayRole.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {u.type === 'marketer' ? (
                      <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Code: {u.code}</span>
                    ) : (
                      u.branches?.name || 'Unassigned'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_active}
                        onCheckedChange={() => handleToggleActive(u.user_id, u.type, u.is_active)}
                        disabled={!isSuperAdmin && u.displayRole === 'admin'} // Regular admins can't deactivate other admins
                      />
                      <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                        {u.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(u)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive font-medium" onClick={() => handleDelete(u.user_id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Revoke Access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  </div>
);
}