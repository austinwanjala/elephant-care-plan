import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MoreHorizontal, Edit, Trash2, Fingerprint, Download, Loader2 } from "lucide-react";
import { BiometricCapture } from "@/components/BiometricCapture";
import { exportToCsv } from "@/utils/csvExport";

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  id_number: string;
  age: number | null;
  coverage_balance: number;
  total_contributions: number;
  benefit_limit: number;
  is_active: boolean;
  biometric_data: string | null;
  branches: { name: string } | null;
  membership_categories: { id: string; name: string; payment_amount: number; benefit_amount: number } | null;
  created_at: string;
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [biometricDialogOpen, setBiometricDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    age: "",
    password: "",
    branchId: "",
    coverageAdjustment: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [membersRes, branchesRes] = await Promise.all([
      supabase.from("members").select("*, branches(name), membership_categories(id, name)").order("created_at", { ascending: false }),
      supabase.from("branches").select("id, name").eq("is_active", true),
    ]);
    if (membersRes.data) setMembers(membersRes.data as any);
    if (branchesRes.data) setBranches(branchesRes.data);
    setLoading(false);
  };

  const handleRegisterMember = async () => {
    setLoading(true);
    try {
      const ageInt = parseInt(formData.age);
      if (isNaN(ageInt)) throw new Error("Valid age is required.");

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          metadata: {
            role: 'member',
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            age: ageInt,
            branch_id: formData.branchId || null,
          }
        }
      });

      if (error) throw error;

      toast({ title: "Member registered successfully" });
      setDialogOpen(false);
      setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "", branchId: "", coverageAdjustment: "" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = async () => {
    if (!selectedMember) return;
    setLoading(true);
    try {
      const adjustment = parseFloat(formData.coverageAdjustment);
      const hasAdjustment = !isNaN(adjustment) && adjustment > 0;

      // 1. Update Profile Details & Coverage directly
      const updates: any = {
        full_name: formData.fullName,
        phone: formData.phone,
        id_number: formData.idNumber,
        age: parseInt(formData.age),
        branch_id: formData.branchId || null,
      };

      if (hasAdjustment) {
        updates.coverage_balance = (selectedMember.coverage_balance || 0) + adjustment;
        updates.is_active = true; // Ensure they are marked as covered
      }

      const { error } = await supabase.from("members").update(updates).eq("id", selectedMember.id);

      if (error) throw error;

      // 2. Record in payments table for history if adjustment was made
      if (hasAdjustment) {
        const { error: payError } = await supabase.from("payments").insert({
          member_id: selectedMember.id,
          amount: 0, 
          coverage_added: adjustment,
          status: "completed",
          mpesa_reference: "Admin Adjustment",
          payment_date: new Date().toISOString()
        });

        if (payError) throw payError;

        // Log system action
        await supabase.from("system_logs").insert({
          action: "ADMIN_ADD_COVERAGE",
          details: {
            member_id: selectedMember.id,
            amount_added: adjustment,
            admin_id: (await supabase.auth.getUser()).data.user?.id
          }
        });
      }

      toast({ title: "Member updated successfully" });
      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("Deactivate member?")) return;
    await supabase.from("members").update({ is_active: false }).eq("id", id);
    loadData();
  };

  const handleBiometricCaptureComplete = async (data: string) => {
    if (!selectedMember) return;
    await supabase.from("members").update({ biometric_data: data }).eq("id", selectedMember.id);
    setBiometricDialogOpen(false);
    loadData();
  };

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.member_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-serif font-bold">Members</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv("members.csv", filteredMembers)}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Register Member</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Register New Member</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2"><Label>Full Name *</Label><Input value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required /></div>
                <div className="space-y-2"><Label>ID Number *</Label><Input value={formData.idNumber} onChange={e => setFormData({ ...formData, idNumber: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Age *</Label><Input type="number" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Password *</Label><Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required /></div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Branch</Label>
                  <Select value={formData.branchId} onValueChange={v => setFormData({ ...formData, branchId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleRegisterMember} className="w-full btn-primary" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Register Member"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search members..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      <div className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && members.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredMembers.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.member_number}</TableCell>
                <TableCell className="font-medium">{m.full_name}</TableCell>
                <TableCell>{m.phone}</TableCell>
                <TableCell>KES {m.coverage_balance.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={m.is_active ? "default" : "destructive"}>
                    {m.is_active ? "Covered" : "Uncovered"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelectedMember(m); setFormData({ ...formData, fullName: m.full_name, phone: m.phone, idNumber: m.id_number, age: m.age?.toString() || "", branchId: m.branch_id || "", coverageAdjustment: "" }); setEditDialogOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSelectedMember(m); setBiometricDialogOpen(true); }}><Fingerprint className="mr-2 h-4 w-4" /> Biometric</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMember(m.id)}><Trash2 className="mr-2 h-4 w-4" /> Deactivate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>ID Number</Label><Input value={formData.idNumber} onChange={e => setFormData({ ...formData, idNumber: e.target.value })} /></div>
            <div className="space-y-2"><Label>Age</Label><Input type="number" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} /></div>

            <div className="pt-4 border-t">
              <Label className="text-green-600 font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Coverage Balance
              </Label>
              <div className="text-xs text-muted-foreground mb-2">
                Enter amount to manually add to the member's coverage balance. This will also activate the account.
              </div>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={formData.coverageAdjustment}
                onChange={e => setFormData({ ...formData, coverageAdjustment: e.target.value })}
              />
            </div>
            <Button onClick={handleEditMember} className="btn-primary" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Update Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={biometricDialogOpen} onOpenChange={setBiometricDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Capture Biometric</DialogTitle></DialogHeader>
          {selectedMember && <BiometricCapture mode="register" userId={selectedMember.id} userName={selectedMember.full_name} onCaptureComplete={handleBiometricCaptureComplete} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}