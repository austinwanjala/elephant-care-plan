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
import { Switch } from "@/components/ui/switch";
import { Search, Plus, MoreHorizontal, Edit, Trash2, Fingerprint, Download, Loader2, ShieldCheck, History, Users, Image as ImageIcon, CreditCard as CreditCardIcon, QrCode } from "lucide-react";
import { BiometricCapture } from "@/components/BiometricCapture";
import { exportToCsv } from "@/utils/csvExport";
import { InsuranceCard } from "@/components/member/InsuranceCard";
import { generateCardPDF } from "@/utils/generateCardPDF";
import { registerExternalBiometric } from "@/services/biometrics";

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  id_number: string;
  age: number | null;
  dob: string | null;
  coverage_balance: number;
  total_contributions: number;
  benefit_limit: number;
  is_active: boolean;
  biometric_data: string | null;
  branch_id: string | null;
  membership_category_id: string | null;
  branches: { name: string } | null;
  membership_categories: { id: string; name: string; payment_amount: number; benefit_amount: number } | null;
  created_at: string;
  insurance_card_token: string | null;
}

interface Category {
  id: string;
  name: string;
  benefit_amount: number;
  payment_amount: number;
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [biometricDialogOpen, setBiometricDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [dependantsDialogOpen, setDependantsDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isExportingCard, setIsExportingCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    dob: "",
    password: "",
    branchId: "",
    membershipCategoryId: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [membersRes, branchesRes, categoriesRes] = await Promise.all([
      supabase.from("members").select("*, branches(name), membership_categories(*)").order("created_at", { ascending: false }),
      supabase.from("branches").select("id, name").eq("is_active", true),
      supabase.from("membership_categories").select("id, name, benefit_amount, payment_amount").eq("is_active", true),
    ]);
    if (membersRes.data) setMembers(membersRes.data as any);
    if (branchesRes.data) setBranches(branchesRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setLoading(false);
  };

  const handleRegisterMember = async () => {
    setLoading(true);
    try {
      if (!formData.dob) throw new Error("Date of Birth is required.");

      const today = new Date();
      const birthDate = new Date(formData.dob);
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          metadata: {
            role: 'member',
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            age: calculatedAge,
            dob: formData.dob,
            branch_id: formData.branchId || null,
            whatsapp_opt_in: (formData as any).whatsappOptIn || false,
          }
        }
      });

      if (error) throw error;

      // Send Welcome SMS
      try {
        await supabase.functions.invoke('send-sms', {
          body: {
            type: 'welcome',
            phone: formData.phone,
            data: { name: formData.fullName }
          }
        });
      } catch (smsErr) {
        console.error("Failed to send Welcome SMS:", smsErr);
        // Don't block success UI if SMS fails
      }

      toast({ title: "Member registered successfully" });
      setDialogOpen(false);
      setFormData({ fullName: "", email: "", phone: "", idNumber: "", dob: "", password: "", branchId: "", membershipCategoryId: "", whatsappOptIn: false } as any);
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
      const categoryChanged = formData.membershipCategoryId !== selectedMember.membership_category_id;
      const selectedCategory = categories.find(c => c.id === formData.membershipCategoryId);

      // 1. Prepare updates
      let age = selectedMember.age;

      if (formData.dob) {
        const today = new Date();
        const birthDate = new Date(formData.dob);
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        age = calculatedAge;
      }

      const updates: any = {
        full_name: formData.fullName,
        phone: formData.phone,
        id_number: formData.idNumber,
        age: age,
        dob: formData.dob || null,
        branch_id: formData.branchId || null,
        membership_category_id: formData.membershipCategoryId || null,
        whatsapp_opt_in: (formData as any).whatsappOptIn || false,
      };

      // 2. If scheme changed, update limits and balance
      if (categoryChanged && selectedCategory) {
        updates.benefit_limit = selectedCategory.benefit_amount;
        updates.coverage_balance = (selectedMember.coverage_balance || 0) + selectedCategory.benefit_amount;
        updates.is_active = true;
      }

      const { error } = await supabase.from("members").update(updates).eq("id", selectedMember.id);

      if (error) throw error;

      // 3. Record in payments table if scheme was assigned/changed
      if (categoryChanged && selectedCategory) {
        const { error: payError } = await supabase.from("payments").insert({
          member_id: selectedMember.id,
          amount: selectedCategory.payment_amount,
          coverage_added: selectedCategory.benefit_amount,
          status: "completed",
          mpesa_reference: "Admin Scheme Assignment",
          reference: `SCHEME-ADMIN-${Date.now()}`,
          payment_date: new Date().toISOString()
        });

        if (payError) throw payError;

        // Log system action
        await supabase.from("system_logs").insert({
          action: "ADMIN_ASSIGN_SCHEME",
          details: {
            member_id: selectedMember.id,
            scheme_name: selectedCategory.name,
            benefit_added: selectedCategory.benefit_amount,
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

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Invalid password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-reset-password", {
        body: {
          userId: resettingUser.user_id,
          email: resettingUser.email || null,
          password: newPassword,
        }
      });
      if (error) {
        const errorData = await error.context?.json().catch(() => ({}));
        throw new Error(errorData?.error || error.message);
      }
      toast({ title: "Success", description: `Password for ${resettingUser.full_name} has been reset and notification sent.` });
      setResetPasswordOpen(false);
      setResettingUser(null);
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
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
    try {
      await registerExternalBiometric({
        memberId: selectedMember.id,
        templateBase64: data,
        format: "unknown"
      });
      setBiometricDialogOpen(false);
      loadData();
      toast({ title: "Success", description: "Member biometrics updated." });
    } catch (err: any) {
      toast({ title: "Capture Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadCard = async () => {
    if (!selectedMember) return;
    setIsExportingCard(true);
    try {
      await generateCardPDF("member-insurance-card", selectedMember.full_name);
      toast({ title: "Success", description: "Insurance card PDF generated successfully." });
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsExportingCard(false);
    }
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
                <div className="space-y-2"><Label>Date of Birth *</Label><Input type="date" max={new Date().toISOString().split("T")[0]} value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Password *</Label><Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required /></div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Branch</Label>
                  <Select value={formData.branchId} onValueChange={v => setFormData({ ...formData, branchId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 md:col-span-2 pt-2">
                  <Switch
                    id="whatsapp-opt-in"
                    checked={(formData as any).whatsappOptIn || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, whatsappOptIn: checked } as any)}
                  />
                  <Label htmlFor="whatsapp-opt-in" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I agree to receive WhatsApp updates regarding my medical cover.
                  </Label>
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Branch</TableHead>
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
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {m.branches?.name || "No Branch"}
                    </Badge>
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => { setSelectedMember(m); setFormData({ ...formData, fullName: m.full_name, phone: m.phone, idNumber: m.id_number, dob: m.dob || "", branchId: m.branch_id || "", membershipCategoryId: m.membership_category_id || "", whatsappOptIn: (m as any).whatsapp_opt_in || false } as any); setEditDialogOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setResettingUser(m); setResetPasswordOpen(true); }}><ShieldCheck className="mr-2 h-4 w-4" /> Reset Password</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedMember(m); setDependantsDialogOpen(true); }}><Users className="mr-2 h-4 w-4" /> View Dependants</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedMember(m); setHistoryDialogOpen(true); }}><History className="mr-2 h-4 w-4" /> View History</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedMember(m); setCardDialogOpen(true); }}><CreditCardIcon className="mr-2 h-4 w-4" /> Digital Card</DropdownMenuItem>
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
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>ID Number</Label><Input value={formData.idNumber} onChange={e => setFormData({ ...formData, idNumber: e.target.value })} /></div>
            <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" max={new Date().toISOString().split("T")[0]} value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} /></div>

            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label className="text-primary font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Membership Scheme
                </Label>
                <Select value={formData.membershipCategoryId} onValueChange={v => setFormData({ ...formData, membershipCategoryId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a scheme to activate/upgrade" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} (Benefit: KES {cat.benefit_amount.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Changing the scheme will add the new benefit amount to the member's balance and activate their account.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="edit-whatsapp-opt-in"
                checked={(formData as any).whatsappOptIn || false}
                onCheckedChange={(checked) => setFormData({ ...formData, whatsappOptIn: checked } as any)}
              />
              <Label htmlFor="edit-whatsapp-opt-in" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I agree to receive WhatsApp updates regarding my medical cover.
              </Label>
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

      {selectedMember && (
        <MemberHistoryDialog
          open={!!historyDialogOpen}
          onOpenChange={(open) => !open && setHistoryDialogOpen(false)}
          member={selectedMember}
        />
      )}

      {selectedMember && (
        <MemberDependantsDialog
          open={!!dependantsDialogOpen}
          onOpenChange={(open) => !open && setDependantsDialogOpen(false)}
          member={selectedMember}
        />
      )}

      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="hidden">Insurance Card</DialogTitle>
          {selectedMember && (
            <div className="space-y-4">
              <div id="member-insurance-card">
                <InsuranceCard member={selectedMember as any} />
              </div>
              <div className="px-4 pb-4">
                <Button
                  onClick={handleDownloadCard}
                  className="w-full btn-primary bg-primary hover:bg-primary/90 text-white shadow-lg"
                  disabled={isExportingCard}
                >
                  {isExportingCard ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                  Download Printable PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Reset Member Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resettingUser?.full_name}. This will be sent to them via SMS/Email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Manual Password</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <Button variant="outline" onClick={() => setNewPassword(Math.random().toString(36).slice(-8))}>
                  Generate
                </Button>
              </div>
            </div>
            <Button onClick={handleResetPassword} className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm Reset & Notify"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberHistoryDialog({ open, onOpenChange, member }: { open: boolean, onOpenChange: (open: boolean) => void, member: Member }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && member) {
      fetchHistory();
    }
  }, [open, member]);

  const fetchHistory = async () => {
    setLoading(true);
    // Fetch visits including dependants metadata
    const { data: visitsData, error: visitsError } = await supabase
      .from("visits")
      .select(`
            *,
            branches(name),
            doctor:doctor_id(full_name),
            dependants(full_name),
            xray_urls,
            bills(
              id,
              total_benefit_cost,
              bill_items(id, service_name, service_id)
            )
        `)
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    if (visitsError) {
      toast({
        title: "Error fetching visits",
        description: visitsError.message,
        variant: "destructive"
      });
    }

    // Fetch dental records for these visits to show treated teeth
    const { data: dentalData } = await supabase
      .from("dental_records")
      .select("visit_id, tooth_number")
      .eq("member_id", member.id);

    // Fetch service stages to show progress
    const { data: stagesData } = await (supabase as any)
      .from("service_stages")
      .select("*")
      .eq("member_id", member.id);

    if (visitsData) {
      // Map dental records and stages to visits
      const enhancedVisits = (visitsData as any[]).map(v => {
        const visitTeeth = dentalData
          ?.filter(d => (d as any).visit_id === v.id)
          .map(d => (d as any).tooth_number)
          .sort((a, b) => ((a as number) || 0) - ((b as number) || 0)) || [];

        const visitStages = (stagesData as any[])?.filter(s => s.visit_id === v.id) || [];

        return {
          ...v,
          treatedTeeth: Array.from(new Set(visitTeeth.filter(t => t !== null))),
          stages: visitStages
        };
      });
      setVisits(enhancedVisits);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Medical History: {member.full_name}</DialogTitle>
          <DialogDescription>Member #: {member.member_number}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : visits.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No visits recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Services & Stages</TableHead>
                  <TableHead>Teeth</TableHead>
                  <TableHead>Clinical Info</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="whitespace-nowrap">{new Date(visit.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {visit.dependant_id ? (
                        <div className="flex items-center gap-1 text-blue-600 font-medium">
                          <Users className="h-3 w-3" /> {visit.dependants?.full_name}
                        </div>
                      ) : (
                        <span className="font-medium">Principal</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {visit.bills?.[0]?.bill_items?.map((item: any) => {
                          const stage = visit.stages?.find((s: any) => s.service_id === item.service_id);
                          return (
                            <div key={item.id} className="text-xs">
                              {item.service_name}
                              {stage && !item.service_name.includes("Stage") && (
                                <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0 h-4">
                                  Stage {stage.current_stage}/{stage.total_stages}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                        {(!visit.bills?.[0] || visit.bills[0].bill_items?.length === 0) && "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[100px]">
                        {visit.treatedTeeth?.map((t: number) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">{t}</Badge>
                        ))}
                        {(!visit.treatedTeeth || visit.treatedTeeth.length === 0) && "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2 min-w-[180px]">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase block">Diagnosis & Status</span>
                          <div className="text-xs font-medium" title={visit.diagnosis || ''}>
                            {visit.diagnosis || '-'}
                          </div>
                          {visit.periodontal_status && visit.periodontal_status.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {visit.periodontal_status.map((s: string) => (
                                <Badge key={s} variant="secondary" className="text-[9px] px-1 py-0 h-3.5 capitalize bg-slate-100">{s}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {(visit.treatment_done || visit.tca) && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            {visit.treatment_done && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Treatment Done</span>
                                <p className="text-xs leading-tight italic text-slate-600" title={visit.treatment_done}>{visit.treatment_done}</p>
                              </div>
                            )}
                            {visit.tca && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-blue-600 uppercase block">TCA / Next Steps</span>
                                <p className="text-xs font-semibold text-blue-700" title={visit.tca}>{visit.tca}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {visit.xray_urls && visit.xray_urls.length > 0 && (
                          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide pt-1">
                            {visit.xray_urls.map((url: string, idx: number) => (
                              <Dialog key={idx}>
                                <DialogTrigger asChild>
                                  <div className="relative cursor-pointer group rounded border overflow-hidden h-10 w-10 flex-shrink-0 bg-slate-100">
                                    <img src={url} alt="X-ray thumbnail" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <ImageIcon className="h-4 w-4 text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl p-1 bg-black/90 border-0">
                                  <DialogHeader className="hidden"><DialogTitle>X-Ray View</DialogTitle></DialogHeader>
                                  <div className="flex items-center justify-center min-h-[50vh]">
                                    <img src={url} alt="X-ray clinical view" className="max-h-[85vh] w-auto object-contain" />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">KES {(visit.bills?.[0]?.total_benefit_cost || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{visit.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberDependantsDialog({ open, onOpenChange, member }: { open: boolean, onOpenChange: (open: boolean) => void, member: Member }) {
  const [dependants, setDependants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && member) {
      fetchDependants();
    }
  }, [open, member]);

  const fetchDependants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dependants")
      .select("*")
      .eq("member_id", member.id)
      .eq("is_active", true);

    if (!error && data) {
      setDependants(data);
    }
    setLoading(false);
  };

  const calculateAge = (dob: string) => {
    const diffMs = Date.now() - new Date(dob).getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dependants: {member.full_name}</DialogTitle>
          <DialogDescription>Registered dependants under this member</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : dependants.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-md">
              No dependants registered.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>ID / Birth Cert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependants.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell className="font-medium">{dep.full_name}</TableCell>
                    <TableCell className="capitalize">{dep.relationship}</TableCell>
                    <TableCell className="capitalize">{dep.gender || '-'}</TableCell>
                    <TableCell>{calculateAge(dep.dob)} yrs</TableCell>
                    <TableCell>{new Date(dep.dob).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{dep.document_number || dep.id_number || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}