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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Loader2, History, ClipboardList, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface RevenueClaim {
  id: string;
  branch_id: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  director_id: string;
  staff?: { full_name: string };
  branches?: { name: string };
  approved_at?: string;
  paid_at?: string;
}

export default function AdminBranchPayments() {
  const [claims, setClaims] = useState<RevenueClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<RevenueClaim | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = rolesData?.map(r => r.role) || [];
      if (roles.includes('super_admin')) setUserRole('super_admin');
      else if (roles.includes('admin')) setUserRole('admin');
      else if (roles.includes('finance')) setUserRole('finance');
      else if (roles.length > 0) setUserRole(roles[0]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("revenue_claims")
        .select("*, staff:director_id(full_name), branches:branch_id(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error: any) {
      toast({ title: "Load Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAction = async () => {
    if (!selectedClaim || !userRole) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staffMember } = await supabase.from("staff").select("id").eq("user_id", user?.id).single();

      const isFinance = userRole === 'finance' || userRole === 'super_admin';
      const isApproval = selectedClaim.status === 'pending' && !isFinance;

      const updates: any = {
        notes: actionNotes || selectedClaim.notes,
        updated_at: new Date().toISOString()
      };

      if (isApproval) {
        updates.status = 'approved';
        updates.approved_at = new Date().toISOString();
        updates.approved_by = staffMember?.id;
      } else {
        updates.status = 'paid';
        updates.paid_at = new Date().toISOString();
        updates.paid_by = staffMember?.id;
      }

      const { error } = await (supabase as any)
        .from("revenue_claims")
        .update(updates)
        .eq("id", selectedClaim.id);

      if (error) throw error;

      toast({
        title: isApproval ? "Claim Approved" : "Payment Recorded",
        description: isApproval ? "Sent to Finance for payment." : "Claim has been marked as paid."
      });

      setActionDialogOpen(false);
      // Force a refresh of the data
      await loadData();
    } catch (error: any) {
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isFinance = userRole === 'finance' || userRole === 'super_admin';

  // Filter logic: Admin sees pending, Finance sees approved
  const activeClaims = claims.filter(c =>
    isFinance ? c.status === 'approved' : c.status === 'pending'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Branch Revenue Claims</h1>
        <p className="text-muted-foreground">
          {isFinance ? "Process payments for approved branch claims" : "Review and approve revenue claims from branch directors"}
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {isFinance ? "Awaiting Payment" : "Awaiting Approval"} ({activeClaims.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Claim History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="card-elevated p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Director</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeClaims.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No claims requiring action.</TableCell></TableRow>
                  ) : (
                    activeClaims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-bold">{claim.branches?.name}</TableCell>
                        <TableCell>{claim.staff?.full_name}</TableCell>
                        <TableCell className="text-lg font-bold text-blue-700">KES {Number(claim.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => { setSelectedClaim(claim); setActionNotes(""); setActionDialogOpen(true); }}
                            className={isFinance ? "bg-green-600 hover:bg-green-700" : "bg-primary"}
                          >
                            {isFinance ? <><DollarSign className="mr-2 h-4 w-4" /> Pay Claim</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Approve</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="card-elevated p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{claim.branches?.name}</TableCell>
                      <TableCell className="font-bold">KES {Number(claim.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={
                          claim.status === 'paid' ? 'bg-green-100 text-green-800' :
                            claim.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                        }>
                          {claim.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {isFinance ? "Confirm Payout" : "Approve Branch Claim"}
            </DialogTitle>
            <DialogDescription>
              {isFinance
                ? `Record the final payment of KES ${Number(selectedClaim?.amount).toLocaleString()} to ${selectedClaim?.branches?.name}.`
                : `Verify and approve the revenue claim for ${selectedClaim?.branches?.name}.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className={`p-4 rounded-lg ${isFinance ? 'bg-green-50' : 'bg-blue-50'}`}>
              <Label className={`text-xs uppercase font-bold ${isFinance ? 'text-green-600' : 'text-blue-600'}`}>Amount</Label>
              <div className={`text-2xl font-bold ${isFinance ? 'text-green-900' : 'text-blue-900'}`}>KES {Number(selectedClaim?.amount).toLocaleString()}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actionNotes">Notes (Optional)</Label>
              <Textarea
                id="actionNotes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={isFinance ? "e.g., Bank transfer reference" : "e.g., Verified against monthly revenue report"}
              />
            </div>
            <Button onClick={handleProcessAction} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isFinance ? <CheckCircle2 className="mr-2 h-4 w-4" /> : "Approve & Send to Finance"}
              {isFinance ? "Confirm Payment" : "Approve Claim"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}