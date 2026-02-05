import { useState, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, MoreHorizontal, Edit, Settings, Shield, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";

interface Service {
  id: string;
  name: string;
  real_cost: number;
  branch_compensation: number;
  benefit_cost: number;
  profit_loss: number;
  approval_type: "all_branches" | "pre_approved_only";
  is_active: boolean;
}

interface Branch {
  id: string;
  name: string;
}

interface ServicePreapproval {
  service_id: string;
  branch_id: string;
}

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [preapprovals, setPreapprovals] = useState<ServicePreapproval[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [preapprovalDialogOpen, setPreapprovalDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    realCost: "",
    branchCompensation: "",
    benefitCost: "",
    approvalType: "all_branches" as "all_branches" | "pre_approved_only",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [servicesRes, branchesRes, preapprovalsRes] = await Promise.all([
      supabase.from("services").select("*").order("name"),
      supabase.from("branches").select("id, name").eq("is_active", true),
      supabase.from("service_preapprovals").select("service_id, branch_id"),
    ]);

    if (servicesRes.data) setServices(servicesRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
    if (preapprovalsRes.data) setPreapprovals(preapprovalsRes.data);
  };

  const handleAddService = async () => {
    try {
      const { error } = await supabase.from("services").insert({
        name: formData.name,
        real_cost: parseFloat(formData.realCost),
        branch_compensation: parseFloat(formData.branchCompensation),
        benefit_cost: parseFloat(formData.benefitCost),
        approval_type: formData.approvalType,
      });

      if (error) throw error;

      toast({ title: "Service added successfully" });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditService = async () => {
    if (!selectedService) return;

    try {
      const { error } = await supabase
        .from("services")
        .update({
          name: formData.name,
          real_cost: parseFloat(formData.realCost),
          branch_compensation: parseFloat(formData.branchCompensation),
          benefit_cost: parseFloat(formData.benefitCost),
          approval_type: formData.approvalType,
        })
        .eq("id", selectedService.id);

      if (error) throw error;

      toast({ title: "Service updated successfully" });
      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !service.is_active })
        .eq("id", service.id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSavePreapprovals = async () => {
    if (!selectedService) return;

    try {
      // Delete existing preapprovals
      await supabase
        .from("service_preapprovals")
        .delete()
        .eq("service_id", selectedService.id);

      // Insert new preapprovals
      if (selectedBranches.length > 0) {
        const { error } = await supabase.from("service_preapprovals").insert(
          selectedBranches.map((branchId) => ({
            service_id: selectedService.id,
            branch_id: branchId,
          }))
        );

        if (error) throw error;
      }

      toast({ title: "Pre-approved branches updated" });
      setPreapprovalDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (service: Service) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      realCost: service.real_cost.toString(),
      branchCompensation: service.branch_compensation.toString(),
      benefitCost: service.benefit_cost.toString(),
      approvalType: service.approval_type,
    });
    setEditDialogOpen(true);
  };

  const openPreapprovalDialog = (service: Service) => {
    setSelectedService(service);
    const serviceBranches = preapprovals
      .filter((p) => p.service_id === service.id)
      .map((p) => p.branch_id);
    setSelectedBranches(serviceBranches);
    setPreapprovalDialogOpen(true);
  };



  const resetForm = () => {
    setFormData({
      name: "",
      realCost: "",
      branchCompensation: "",
      benefitCost: "",
      approvalType: "all_branches",
    });
  };

  const handleExport = () => {
    const dataToExport = services.map(s => ({
      "Procedure Name": s.name,
      "Real Cost": s.real_cost,
      "Branch Compensation": s.branch_compensation,
      "Benefit Cost": s.benefit_cost,
      "Profit/Loss": s.profit_loss,
      "Approval": s.approval_type === "all_branches" ? "All Branches" : "Pre-Approved Only",
      "Active": s.is_active ? "Yes" : "No"
    }));
    exportToCsv("services_export.csv", dataToExport);
  };

  const getApprovalBadge = (type: string) => {
    if (type === "all_branches") {
      return <Badge className="bg-success">All Branches</Badge>;
    }
    return <Badge variant="secondary">Pre-Approved Only</Badge>;
  };

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Services</h1>
          <p className="text-muted-foreground">Manage dental services and pricing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary">
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Add New Service</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Procedure Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Tooth Extraction"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Real Cost (KES) *</Label>
                    <Input
                      type="number"
                      value={formData.realCost}
                      onChange={(e) => setFormData({ ...formData, realCost: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch Compensation (KES) *</Label>
                    <Input
                      type="number"
                      value={formData.branchCompensation}
                      onChange={(e) => setFormData({ ...formData, branchCompensation: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Benefit Cost (KES) *</Label>
                  <Input
                    type="number"
                    value={formData.benefitCost}
                    onChange={(e) => setFormData({ ...formData, benefitCost: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Approval Type</Label>
                  <Select
                    value={formData.approvalType}
                    onValueChange={(value: "all_branches" | "pre_approved_only") =>
                      setFormData({ ...formData, approvalType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_branches">All Branches</SelectItem>
                      <SelectItem value="pre_approved_only">Pre-Approved Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.realCost && formData.branchCompensation && formData.benefitCost && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span>Profit/Loss:</span>
                      <span className={parseFloat(formData.benefitCost) - parseFloat(formData.branchCompensation) >= 0 ? "text-success" : "text-destructive"}>
                        KES {(parseFloat(formData.benefitCost) - parseFloat(formData.branchCompensation)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                <Button onClick={handleAddService} className="btn-primary">
                  Add Service
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
                <TableHead>Procedure</TableHead>
                <TableHead>Real Cost</TableHead>
                <TableHead>Branch Comp.</TableHead>
                <TableHead>Benefit Cost</TableHead>
                <TableHead>Profit/Loss</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>KES {service.real_cost.toLocaleString()}</TableCell>
                  <TableCell>KES {service.branch_compensation.toLocaleString()}</TableCell>
                  <TableCell>KES {service.benefit_cost.toLocaleString()}</TableCell>
                  <TableCell className={service.profit_loss >= 0 ? "text-success" : "text-destructive"}>
                    KES {service.profit_loss.toLocaleString()}
                  </TableCell>
                  <TableCell>{getApprovalBadge(service.approval_type)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={service.is_active}
                      onCheckedChange={() => handleToggleActive(service)}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(service)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {service.approval_type === "pre_approved_only" && (
                          <DropdownMenuItem onClick={() => openPreapprovalDialog(service)}>
                            <Shield className="mr-2 h-4 w-4" /> Manage Branches
                          </DropdownMenuItem>
                        )}
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
            <DialogTitle className="font-serif">Edit Service</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Procedure Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Real Cost (KES)</Label>
                <Input
                  type="number"
                  value={formData.realCost}
                  onChange={(e) => setFormData({ ...formData, realCost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Branch Compensation (KES)</Label>
                <Input
                  type="number"
                  value={formData.branchCompensation}
                  onChange={(e) => setFormData({ ...formData, branchCompensation: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Benefit Cost (KES)</Label>
              <Input
                type="number"
                value={formData.benefitCost}
                onChange={(e) => setFormData({ ...formData, benefitCost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Approval Type</Label>
              <Select
                value={formData.approvalType}
                onValueChange={(value: "all_branches" | "pre_approved_only") =>
                  setFormData({ ...formData, approvalType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_branches">All Branches</SelectItem>
                  <SelectItem value="pre_approved_only">Pre-Approved Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEditService} className="btn-primary">
              Update Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-approval Dialog */}
      <Dialog open={preapprovalDialogOpen} onOpenChange={setPreapprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Manage Pre-Approved Branches</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Select branches that can perform "{selectedService?.name}"
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {branches.map((branch) => (
                <div key={branch.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={branch.id}
                    checked={selectedBranches.includes(branch.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedBranches([...selectedBranches, branch.id]);
                      } else {
                        setSelectedBranches(selectedBranches.filter((id) => id !== branch.id));
                      }
                    }}
                  />
                  <Label htmlFor={branch.id}>{branch.name}</Label>
                </div>
              ))}
            </div>
            <Button onClick={handleSavePreapprovals} className="w-full btn-primary">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
