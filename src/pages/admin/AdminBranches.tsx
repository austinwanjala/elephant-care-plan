import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";

interface Branch {
  id: string;
  name: string;
  location: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_globally_preapproved_for_services: boolean | null;
}

interface BranchRevenue {
  branch_id: string;
  total_compensation: number;
  visit_count: number;
}

export default function AdminBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [revenue, setRevenue] = useState<Record<string, BranchRevenue>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    phone: "",
    email: "",
    isGloballyPreapprovedForServices: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [branchesRes, revenueRes] = await Promise.all([
      supabase.from("branches").select("*").order("name"),
      supabase.from("branch_revenue").select("branch_id, total_compensation, visit_count"),
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (revenueRes.data) {
      const revenueMap: Record<string, BranchRevenue> = {};
      revenueRes.data.forEach((r) => {
        if (!revenueMap[r.branch_id]) {
          revenueMap[r.branch_id] = { branch_id: r.branch_id, total_compensation: 0, visit_count: 0 };
        }
        revenueMap[r.branch_id].total_compensation += r.total_compensation;
        revenueMap[r.branch_id].visit_count += r.visit_count;
      });
      setRevenue(revenueMap);
    }
  };

  const handleAddBranch = async () => {
    try {
      const { error } = await supabase.from("branches").insert({
        name: formData.name,
        location: formData.location,
        phone: formData.phone || null,
        email: formData.email || null,
        is_globally_preapproved_for_services: formData.isGloballyPreapprovedForServices,
      });

      if (error) throw error;

      toast({ title: "Branch added successfully" });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditBranch = async () => {
    if (!selectedBranch) return;

    try {
      const { error } = await supabase
        .from("branches")
        .update({
          name: formData.name,
          location: formData.location,
          phone: formData.phone || null,
          email: formData.email || null,
          is_globally_preapproved_for_services: formData.isGloballyPreapprovedForServices,
        })
        .eq("id", selectedBranch.id);

      if (error) throw error;

      toast({ title: "Branch updated successfully" });
      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      const { error } = await supabase
        .from("branches")
        .update({ is_active: !branch.is_active })
        .eq("id", branch.id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm("Are you sure you want to delete this branch?")) return;

    try {
      const { error } = await supabase.from("branches").delete().eq("id", branchId);
      if (error) throw error;

      toast({ title: "Branch deleted" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location,
      phone: branch.phone || "",
      email: branch.email || "",
      isGloballyPreapprovedForServices: branch.is_globally_preapproved_for_services || false,
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: "", location: "", phone: "", email: "", isGloballyPreapprovedForServices: false });
  };

  const handleExport = () => {
    const dataToExport = branches.map(b => ({
      "Branch Name": b.name,
      "Location": b.location,
      "Phone": b.phone || "",
      "Email": b.email || "",
      "Revenue": revenue[b.id]?.total_compensation || 0,
      "Visits": revenue[b.id]?.visit_count || 0,
      "Status": b.is_active ? "Active" : "Inactive",
      "Global Pre-approval": b.is_globally_preapproved_for_services ? "Yes" : "No"
    }));
    exportToCsv("branches_export.csv", dataToExport);
  };

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Branches</h1>
          <p className="text-muted-foreground">Manage hospital branches and locations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="mr-2 h-4 w-4" /> Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Add New Branch</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Branch Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Westlands Branch"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Westlands, Nairobi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+254700000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="branch@elephantdental.co.ke"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="globally-preapproved"
                    checked={formData.isGloballyPreapprovedForServices}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isGloballyPreapprovedForServices: checked })
                    }
                  />
                  <Label htmlFor="globally-preapproved">Globally Pre-approved for Services</Label>
                </div>
                <Button onClick={handleAddBranch} className="btn-primary">
                  Add Branch
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Global Pre-approval</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.location}</TableCell>
                  <TableCell>{branch.phone || "N/A"}</TableCell>
                  <TableCell>{branch.email || "N/A"}</TableCell>
                  <TableCell className="text-success">
                    KES {(revenue[branch.id]?.total_compensation || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>{revenue[branch.id]?.visit_count || 0}</TableCell>
                  <TableCell>
                    <Switch
                      checked={branch.is_active}
                      onCheckedChange={() => handleToggleActive(branch)}
                    />
                  </TableCell>
                  <TableCell>
                    {branch.is_globally_preapproved_for_services ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(branch)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteBranch(branch.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            <DialogTitle className="font-serif">Edit Branch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
              <Label>Email</Label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="globally-preapproved-edit"
                checked={formData.isGloballyPreapprovedForServices}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isGloballyPreapprovedForServices: checked })
                }
              />
              <Label htmlFor="globally-preapproved-edit">Globally Pre-approved for Services</Label>
            </div>
            <Button onClick={handleEditBranch} className="btn-primary">
              Update Branch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}