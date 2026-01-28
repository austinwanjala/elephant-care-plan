import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Users,
  CreditCard,
  FileText,
  LogOut,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Branch {
  id: string;
  name: string;
  location: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  total_contributions: number;
  is_active: boolean;
  branches: { name: string } | null;
}

interface Staff {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
  is_active: boolean;
  branches: { name: string } | null;
}

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  members: { full_name: string; member_number: string } | null;
  branches: { name: string } | null;
}

interface Stats {
  totalMembers: number;
  totalContributions: number;
  totalCoverage: number;
  totalClaims: number;
  pendingClaims: number;
}

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalContributions: 0,
    totalCoverage: 0,
    totalClaims: 0,
    pendingClaims: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", location: "", phone: "", email: "" });
  const [newStaff, setNewStaff] = useState({ fullName: "", email: "", phone: "", password: "", branchId: "" });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      toast({
        title: "Access denied",
        description: "You don't have admin privileges",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    await Promise.all([
      loadBranches(),
      loadMembers(),
      loadStaff(),
      loadClaims(),
      loadStats(),
    ]);
    setLoading(false);
  };

  const loadBranches = async () => {
    const { data } = await supabase.from("branches").select("*").order("name");
    if (data) setBranches(data);
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from("members")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });
    if (data) setMembers(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });
    if (data) setStaff(data);
  };

  const loadClaims = async () => {
    const { data } = await supabase
      .from("claims")
      .select("*, members(full_name, member_number), branches(name)")
      .order("created_at", { ascending: false });
    if (data) setClaims(data);
  };

  const loadStats = async () => {
    const [membersRes, claimsRes] = await Promise.all([
      supabase.from("members").select("coverage_balance, total_contributions"),
      supabase.from("claims").select("status"),
    ]);

    if (membersRes.data && claimsRes.data) {
      setStats({
        totalMembers: membersRes.data.length,
        totalContributions: membersRes.data.reduce((sum, m) => sum + (m.total_contributions || 0), 0),
        totalCoverage: membersRes.data.reduce((sum, m) => sum + (m.coverage_balance || 0), 0),
        totalClaims: claimsRes.data.length,
        pendingClaims: claimsRes.data.filter((c) => c.status === "pending").length,
      });
    }
  };

  const handleAddBranch = async () => {
    try {
      const { error } = await supabase.from("branches").insert({
        name: newBranch.name,
        location: newBranch.location,
        phone: newBranch.phone || null,
        email: newBranch.email || null,
      });

      if (error) throw error;

      toast({ title: "Branch added successfully" });
      setBranchDialogOpen(false);
      setNewBranch({ name: "", location: "", phone: "", email: "" });
      loadBranches();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddStaff = async () => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newStaff.email,
        password: newStaff.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Create staff record
      const { error: staffError } = await supabase.from("staff").insert({
        user_id: authData.user.id,
        full_name: newStaff.fullName,
        email: newStaff.email,
        phone: newStaff.phone || null,
        branch_id: newStaff.branchId || null,
      });

      if (staffError) throw staffError;

      // Assign staff role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "staff",
      });

      if (roleError) throw roleError;

      toast({ title: "Staff member added successfully" });
      setStaffDialogOpen(false);
      setNewStaff({ fullName: "", email: "", phone: "", password: "", branchId: "" });
      loadStaff();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateClaimStatus = async (claimId: string, status: "completed" | "rejected") => {
    try {
      const { error } = await supabase
        .from("claims")
        .update({ status, processed_at: new Date().toISOString() })
        .eq("id", claimId);

      if (error) throw error;

      toast({ title: `Claim ${status}` });
      loadClaims();
      loadStats();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      completed: "badge-success",
      pending: "badge-warning",
      approved: "badge-success",
      rejected: "badge-error",
    };
    return badges[status] || "badge-warning";
  };

  const filteredMembers = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.member_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl">🐘</span>
            </div>
            <div>
              <span className="text-xl font-serif font-bold text-foreground">Elephant Dental</span>
              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Admin</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="stat-card">
            <Users className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.totalMembers}</p>
            <p className="text-sm text-muted-foreground">Members</p>
          </div>
          <div className="stat-card">
            <CreditCard className="h-5 w-5 text-success mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {(stats.totalContributions / 1000).toFixed(0)}K
            </p>
            <p className="text-sm text-muted-foreground">Contributions</p>
          </div>
          <div className="stat-card">
            <Shield className="h-5 w-5 text-accent mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {(stats.totalCoverage / 1000).toFixed(0)}K
            </p>
            <p className="text-sm text-muted-foreground">Coverage</p>
          </div>
          <div className="stat-card">
            <FileText className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.totalClaims}</p>
            <p className="text-sm text-muted-foreground">Claims</p>
          </div>
          <div className="stat-card">
            <FileText className="h-5 w-5 text-accent mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.pendingClaims}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members">
            <div className="card-elevated overflow-hidden">
              <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 justify-between">
                <h2 className="text-xl font-serif font-bold text-foreground">Members</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Contributions</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} className="table-row-hover">
                        <TableCell className="font-mono">{member.member_number}</TableCell>
                        <TableCell>{member.full_name}</TableCell>
                        <TableCell>{member.phone}</TableCell>
                        <TableCell>{member.branches?.name || "N/A"}</TableCell>
                        <TableCell>KES {member.total_contributions.toLocaleString()}</TableCell>
                        <TableCell className="text-success">
                          KES {member.coverage_balance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.is_active ? "badge-success" : "badge-error"}`}>
                            {member.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Branches Tab */}
          <TabsContent value="branches">
            <div className="card-elevated overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-serif font-bold text-foreground">Branches</h2>
                <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-primary">
                      <Plus className="mr-2 h-4 w-4" /> Add Branch
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Add New Branch</DialogTitle>
                      <DialogDescription>Create a new hospital branch</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Branch Name</Label>
                        <Input
                          value={newBranch.name}
                          onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                          placeholder="Westlands Branch"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input
                          value={newBranch.location}
                          onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })}
                          placeholder="Westlands, Nairobi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={newBranch.phone}
                          onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                          placeholder="+254700000000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={newBranch.email}
                          onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                          placeholder="westlands@elephantdental.co.ke"
                        />
                      </div>
                      <Button onClick={handleAddBranch} className="w-full btn-primary">
                        Add Branch
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.id} className="table-row-hover">
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell>{branch.location}</TableCell>
                        <TableCell>{branch.phone || "N/A"}</TableCell>
                        <TableCell>{branch.email || "N/A"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${branch.is_active ? "badge-success" : "badge-error"}`}>
                            {branch.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff">
            <div className="card-elevated overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-serif font-bold text-foreground">Staff</h2>
                <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-primary">
                      <UserPlus className="mr-2 h-4 w-4" /> Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Add New Staff Member</DialogTitle>
                      <DialogDescription>Create a staff account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={newStaff.fullName}
                          onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newStaff.email}
                          onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                          placeholder="john@elephantdental.co.ke"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={newStaff.phone}
                          onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                          placeholder="0712345678"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={newStaff.password}
                          onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Select onValueChange={(value) => setNewStaff({ ...newStaff, branchId: value })}>
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
                      <Button onClick={handleAddStaff} className="w-full btn-primary">
                        Add Staff
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No staff members yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      staff.map((s) => (
                        <TableRow key={s.id} className="table-row-hover">
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell>{s.email}</TableCell>
                          <TableCell>{s.phone || "N/A"}</TableCell>
                          <TableCell>{s.branches?.name || "N/A"}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.is_active ? "badge-success" : "badge-error"}`}>
                              {s.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Claims Tab */}
          <TabsContent value="claims">
            <div className="card-elevated overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-serif font-bold text-foreground">Claims</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No claims yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      claims.map((claim) => (
                        <TableRow key={claim.id} className="table-row-hover">
                          <TableCell>
                            {new Date(claim.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{claim.members?.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {claim.members?.member_number}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{claim.branches?.name}</TableCell>
                          <TableCell>{claim.diagnosis}</TableCell>
                          <TableCell>KES {claim.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(claim.status)}`}>
                              {claim.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {claim.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-success border-success hover:bg-success/10"
                                  onClick={() => handleUpdateClaimStatus(claim.id, "completed")}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive border-destructive hover:bg-destructive/10"
                                  onClick={() => handleUpdateClaimStatus(claim.id, "rejected")}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
