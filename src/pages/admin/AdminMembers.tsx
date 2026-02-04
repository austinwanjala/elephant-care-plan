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
import { Search, Plus, MoreHorizontal, Edit, Trash2, Fingerprint, Download } from "lucide-react";
import { BiometricCapture } from "@/components/BiometricCapture";
import { createClient } from "@supabase/supabase-js";
import { exportToCsv } from "@/utils/csvExport";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

interface MembershipCategory {
  id: string;
  name: string;
  payment_amount: number;
  benefit_amount: number;
  registration_fee: number;
  management_fee: number;
}

interface Branch {
  id: string;
  name: string;
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [biometricDialogOpen, setBiometricDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    age: "",
    password: "",
    branchId: "",
    categoryId: "",
    nextOfKinName: "",
    nextOfKinPhone: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [membersRes, categoriesRes, branchesRes] = await Promise.all([
      supabase
        .from("members")
        .select("*, branches(name), membership_categories(id, name, payment_amount, benefit_amount)")
        .order("created_at", { ascending: false }),
      supabase.from("membership_categories").select("*").eq("is_active", true),
      supabase.from("branches").select("id, name").eq("is_active", true),
    ]);

    if (membersRes.data) setMembers(membersRes.data as any);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
  };

  const handleRegisterMember = async () => {
    try {
      if (!formData.email || !formData.password || !formData.fullName || !formData.phone || !formData.idNumber || !formData.age) {
        toast({ title: "Validation Error", description: "All fields marked with * are required.", variant: "destructive" });
        return;
      }

      // 1. Create Auth account
      const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false }
      });

      const { data: authData, error: authError } = await authClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'member',
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            age: parseInt(formData.age),
            branch_id: formData.branchId || null,
          }
        }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          throw new Error("This email is already registered.");
        }
        throw authError;
      }
      
      const userId = authData.user?.id;
      if (!userId) throw new Error("User creation failed: No ID returned.");

      // 2. Explicitly assign role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: 'member' });

      if (roleError) throw roleError;

      // 3. Explicitly create profile
      const { error: profileError } = await supabase
        .from("members")
        .insert({
          user_id: userId,
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          id_number: formData.idNumber,
          age: parseInt(formData.age),
          branch_id: formData.branchId || null,
          member_number: `ED${Math.floor(100000 + Math.random() * 900000)}`,
          is_active: false,
          coverage_balance: 0,
          total_contributions: 0,
          benefit_limit: 0
        });

      if (profileError) throw profileError;

      toast({ title: "Member registered successfully", description: "Member can now log in to select scheme and make payment." });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditMember = async () => {
    if (!selectedMember) return;

    try {
      const { error } = await supabase
        .from("members")
        .update({
          full_name: formData.fullName,
          phone: formData.phone,
          id_number: formData.idNumber,
          age: parseInt(formData.age),
          branch_id: formData.branchId || null,
          next_of_kin_name: formData.nextOfKinName || null,
          next_of_kin_phone: formData.nextOfKinPhone || null,
        })
        .eq("id", selectedMember.id);

      if (error) throw error;

      toast({ title: "Member updated successfully" });
      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to deactivate this member?")) return;

    try {
      const { error } = await supabase
        .from("members")
        .update({ is_active: false })
        .eq("id", memberId);

      if (error) throw error;

      toast({ title: "Member deactivated" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBiometricCaptureComplete = async (credentialData: string) => {
    if (!selectedMember) return;

    try {
      const { error } = await supabase
        .from("members")
        .update({ biometric_data: credentialData })
        .eq("id", selectedMember.id);

      if (error) throw error;

      toast({ title: "Biometric data captured successfully" });
      setBiometricDialogOpen(false);
      loadData(); 
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (member: Member) => {
    setSelectedMember(member);
    setFormData({
      fullName: member.full_name,
      email: member.email,
      phone: member.phone,
      idNumber: member.id_number,
      age: member.age?.toString() || "",
      password: "", 
      branchId: member.branches ? branches.find(b => b.name === member.branches?.name)?.id || "" : "",
      categoryId: "", 
      nextOfKinName: "", 
      nextOfKinPhone: "", 
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      idNumber: "",
      age: "",
      password: "",
      branchId: "",
      categoryId: "",
      nextOfKinName: "",
      nextOfKinPhone: "",
    });
  };

  const filteredMembers = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.member_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm) ||
      m.id_number.includes(searchTerm)
  );

  const handleExport = () => {
    const dataToExport = filteredMembers.map(m => ({
      "Member Number": m.member_number,
      "Full Name": m.full_name,
      "Phone": m.phone || "",
      "ID Number": m.id_number || "",
      "Age": m.age || "",
      "Category": m.membership_categories?.name || "N/A",
      "Branch": m.branches?.name || "N/A",
      "Coverage Balance": m.coverage_balance,
      "Biometric Captured": m.biometric_data ? "Yes" : "No",
      "Status": m.is_active ? "Active" : "Inactive",
      "Joined Date": new Date(m.created_at).toLocaleDateString()
    }));
    exportToCsv("members_export.csv", dataToExport);
  };

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground">Manage member registrations and profiles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="mr-2 h-4 w-4" /> Register Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif">Register New Member</DialogTitle>
                <DialogDescription>Enter member details. Membership scheme selection and initial payment will be done by the member after login.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0712345678"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ID Number *</Label>
                    <Input
                      value={formData.idNumber}
                      onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                      placeholder="12345678"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Age *</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="30"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Branch (Optional)</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleRegisterMember} className="btn-primary">
                  Register Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, member number, phone, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Biometric</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-mono">{member.member_number}</TableCell>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.id_number}</TableCell>
                  <TableCell>{member.age || "N/A"}</TableCell>
                  <TableCell>{member.membership_categories?.name || "N/A"}</TableCell>
                  <TableCell>{member.branches?.name || "N/A"}</TableCell>
                  <TableCell className="text-success">
                    KES {member.coverage_balance.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {member.biometric_data ? (
                      <span className="text-success text-xs">✓ Captured</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.is_active ? "badge-success" : "badge-error"}`}>
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedMember(member);
                          setBiometricDialogOpen(true);
                        }}>
                          <Fingerprint className="mr-2 h-4 w-4" /> Capture Biometric
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteMember(member.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Member</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ID Number</Label>
              <Input
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData({ ...formData, branchId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEditMember} className="btn-primary">
              Update Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Biometric Dialog */}
      <Dialog open={biometricDialogOpen} onOpenChange={setBiometricDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Capture Biometric Data</DialogTitle>
            <DialogDescription>
              Capture fingerprint or facial recognition for {selectedMember?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {selectedMember && (
              <BiometricCapture
                mode="register"
                userId={selectedMember.id}
                userName={selectedMember.full_name}
                onCaptureComplete={handleBiometricCaptureComplete}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}