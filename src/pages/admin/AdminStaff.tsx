import { useState, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Edit, Trash2, UserCog, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";
import { exportToCsv } from "@/utils/csvExport";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function AdminStaff() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    loadData();
  }, []);

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

  const handleAddUser = async () => {
    setLoading(true);
    try {
      if (!formData.email || !formData.password || !formData.fullName) {
        throw new Error("Email, Password and Full Name are required.");
      }

      const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      // We include id_number and age in metadata because the database triggers 
      // might be expecting them for all new users regardless of role.
      const { data: authData, error: authError } = await authClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: formData.role,
            full_name: formData.fullName,
            phone: formData.phone || null,
            id_number: `STAFF-${Date.now()}`, // Dummy ID to satisfy potential triggers
            age: 30, // Dummy age to satisfy potential triggers
            branch_id: formData.branchId || null,
            marketer_code: formData.marketerCode || null
          }
        }
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("User creation failed: No ID returned.");

      // Explicitly set the role to ensure it's correct even if trigger logic differs
      await supabase.from("user_roles").upsert({ 
        user_id: userId, 
        role: formData.role as any 
      }, { onConflict: 'user_id' });

      // Create the specific profile if it's not a member
      if (formData.role !== 'member') {
        if (formData.role === 'marketer') {
          await supabase.from("marketers").upsert({
            user_id: userId,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
            code: formData.marketerCode || `MKT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            is_active: true,
          }, { onConflict: 'user_id' });
        } else {
          await supabase.from("staff").upsert({
            user_id: userId,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
            branch_id: formData.branchId || null,
            is_active: true,
          }, { onConflict: 'user_id' });
        }
      }

      toast({
        title: "Account Created",
        description: `${formData.fullName} has been added as ${formData.role}.`
      });

      setDialogOpen(false);
      setFormData({ fullName: "", email: "", phone: "", password: "", branchId: "", role: "receptionist", marketerCode: "" });
      loadData();

    } catch (error: any) {
      toast({ title: "Creation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, type: string) => {
    if (!confirm("Are you sure? This will remove the user's access profile.")) return;
    try {
      const table = type === 'marketer' ? 'marketers' : 'staff';
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
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
    const dataToExport = users.map(u => ({
      "Full Name": u.full_name,
      "Email": u.email || "",
      "Phone": u.phone || "",
      "Role": u.displayRole.replace('_', ' '),
      "Branch/Code": u.type === 'marketer' ? `Code: ${u.code}` : (u.branches?.name || 'Unassigned'),
      "Status": u.is_active ? "Active" : "Paused"
    }));
    exportToCsv("staff_export.csv", dataToExport);
  };

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
                <CardDescription>All fields marked with * are required.</CardDescription>
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
                      <SelectItem value="branch_director">Branch Director</SelectItem>
                      <SelectItem value="marketer">Marketer</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role !== 'marketer' && formData.role !== 'admin' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label>Assigned Branch</Label>
                    <Select value={formData.branchId} onValueChange={(v) => setFormData({ ...formData, branchId: v })}>
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
        </div>
      </div>

      <Card className="shadow-sm border-blue-50 overflow-hidden">
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
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No staff members found. Create your first portal user above.</TableCell></TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="font-bold text-slate-900">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground">{u.email || u.phone}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize bg-blue-50 text-blue-700 border-blue-200">
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
                        <DropdownMenuItem className="text-destructive font-medium" onClick={() => handleDelete(u.user_id, u.type)}>
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
      </Card>
    </div>
  );
}