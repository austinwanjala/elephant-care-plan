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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MoreHorizontal, Edit, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface MembershipCategory {
  id: string;
  name: string;
  level: string;
  payment_amount: number;
  benefit_amount: number;
  registration_fee: number;
  management_fee: number;
  is_active: boolean;
}

export default function AdminMembershipCategories() {
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MembershipCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    level: "level_1",
    paymentAmount: "",
    benefitAmount: "",
    registrationFee: "",
    managementFee: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("membership_categories")
      .select("*")
      .order("level", { ascending: true });

    if (error) {
      toast({ title: "Error loading categories", description: error.message, variant: "destructive" });
    } else {
      setCategories(data || []);
    }
  };

  const handleAddCategory = async () => {
    try {
      const { error } = await supabase.from("membership_categories").insert({
        name: formData.name,
        level: formData.level as any,
        payment_amount: parseFloat(formData.paymentAmount),
        benefit_amount: parseFloat(formData.benefitAmount),
        registration_fee: parseFloat(formData.registrationFee),
        management_fee: parseFloat(formData.managementFee),
        is_active: true,
      });

      if (error) throw error;

      toast({ title: "Category added successfully" });
      setDialogOpen(false);
      resetForm();
      loadCategories();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from("membership_categories")
        .update({
          name: formData.name,
          level: formData.level as any,
          payment_amount: parseFloat(formData.paymentAmount),
          benefit_amount: parseFloat(formData.benefitAmount),
          registration_fee: parseFloat(formData.registrationFee),
          management_fee: parseFloat(formData.managementFee),
        })
        .eq("id", selectedCategory.id);

      if (error) throw error;

      toast({ title: "Category updated successfully" });
      setEditDialogOpen(false);
      loadCategories();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (category: MembershipCategory) => {
    try {
      const { error } = await supabase
        .from("membership_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;
      loadCategories();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (category: MembershipCategory) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      level: category.level,
      paymentAmount: category.payment_amount.toString(),
      benefitAmount: category.benefit_amount.toString(),
      registrationFee: category.registration_fee.toString(),
      managementFee: category.management_fee.toString(),
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      level: "level_1",
      paymentAmount: "",
      benefitAmount: "",
      registrationFee: "",
      managementFee: "",
    });
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Membership Categories</h1>
          <p className="text-muted-foreground">Define and manage different membership levels and their benefits.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">Add New Membership Category</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Category Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Basic Plan" required />
              </div>
              <div className="space-y-2">
                <Label>Level *</Label>
                <Select value={formData.level} onValueChange={(value) => setFormData({ ...formData, level: value })} required>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {["level_1", "level_2", "level_3", "level_4", "level_5", "level_6"].map((level) => (
                      <SelectItem key={level} value={level}>{level.replace('_', ' ').toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Amount (KES) *</Label>
                  <Input type="number" value={formData.paymentAmount} onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })} placeholder="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Benefit Amount (KES) *</Label>
                  <Input type="number" value={formData.benefitAmount} onChange={(e) => setFormData({ ...formData, benefitAmount: e.target.value })} placeholder="0" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registration Fee (KES) *</Label>
                  <Input type="number" value={formData.registrationFee} onChange={(e) => setFormData({ ...formData, registrationFee: e.target.value })} placeholder="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Management Fee (KES) *</Label>
                  <Input type="number" value={formData.managementFee} onChange={(e) => setFormData({ ...formData, managementFee: e.target.value })} placeholder="0" required />
                </div>
              </div>
              <Button onClick={handleAddCategory} className="btn-primary">Add Category</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Benefit</TableHead>
                <TableHead>Reg. Fee</TableHead>
                <TableHead>Mgmt. Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{category.level.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>KES {category.payment_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-success">KES {category.benefit_amount.toLocaleString()}</TableCell>
                  <TableCell>KES {category.registration_fee.toLocaleString()}</TableCell>
                  <TableCell>KES {category.management_fee.toLocaleString()}</TableCell>
                  <TableCell><Switch checked={category.is_active} onCheckedChange={() => handleToggleActive(category)} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(category)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit Membership Category</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={formData.level} onValueChange={(value) => setFormData({ ...formData, level: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["level_1", "level_2", "level_3", "level_4", "level_5", "level_6"].map((level) => (
                    <SelectItem key={level} value={level}>{level.replace('_', ' ').toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Amount (KES)</Label>
                <Input type="number" value={formData.paymentAmount} onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Benefit Amount (KES)</Label>
                <Input type="number" value={formData.benefitAmount} onChange={(e) => setFormData({ ...formData, benefitAmount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Registration Fee (KES)</Label>
                <Input type="number" value={formData.registrationFee} onChange={(e) => setFormData({ ...formData, registrationFee: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Management Fee (KES)</Label>
                <Input type="number" value={formData.managementFee} onChange={(e) => setFormData({ ...formData, managementFee: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleEditCategory} className="btn-primary">Update Category</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}