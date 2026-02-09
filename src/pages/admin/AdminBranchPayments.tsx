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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CheckCircle, Loader2, History, ClipboardList, CheckCircle2, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getMonth, getYear, subMonths } from "date-fns";

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface RevenueClaim {
  id: string;
  branch_id: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  director_id: string;
  director_name?: string;
  branch_name?: string;
  approved_at?: string;
  paid_at?: string;
}

export default function AdminBranchPayments() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [revenueSummaries, setRevenueSummaries] = useState<Record<string, number>>({});
  const [claims, setClaims] = useState<RevenueClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<RevenueClaim | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1);
  const [currentYear, setCurrentYear] = useState(getYear(new Date()));
  const [approvalNotes, setApprovalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  const loadData = async (month: number, year: number) => {
    setLoading(true);
    try {
      const [branchesRes, revenueRes, claimsRes] = await Promise.all([
        supabase.from("branches").select("id, name, location").eq("is_active", true).order("name"),
        (supabase as any)
          .from("branch_revenue")
          .select("branch_id, total_compensation")
          .gte("date", format(new Date(year, month - 1, 1), "yyyy-MM-dd"))
          .lt("date", format(new Date(year, month, 1), "yyyy-MM-dd")),
        (supabase as any)
          .from("revenue_claims")
          .select("*, staff:director_id(full_name), branches:branch_id(name)")
          .order("created_at", { ascending: false }),
      ]);

      if (branchesRes.error) throw branchesRes.error;

      if (branchesRes.data) setBranches(branchesRes.data);

      if (revenueRes.data) {
        const summary: Record<string, number> = {};
        branchesRes.data?.forEach(branch => summary[branch.id] = 0);
        revenueRes.data.forEach((r: any) => {
          summary[r.branch_id] = (summary[r.branch_id] || 0) + r.total_compensation;
        });
        setRevenueSummaries(summary);
      }

      if (claimsRes.data) setClaims(claimsRes.data as any);

    } catch (error: any) {
      console.error("Error loading admin data:", error);
      toast({ title: "Load Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClaim = async () => {
    if (!selectedClaim) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data: adminStaff } = await supabase.from("staff").select("id").eq("user_id", user.id).single();

      const { error } = await (supabase as any)
        .from("revenue_claims")
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: adminStaff?.id,
          notes: approvalNotes || null
        })
        .eq("id", selectedClaim.id);

      if (error) throw error;

      toast({ title: "Claim Approved", description: "Claim sent to Finance for payment." });
      setApprovalDialogOpen(false);
      loadData(currentMonth, currentYear);
    } catch (error: any) {
      toast({ title: "Approval Failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getMonthOptions = () => {
    const options = [];
    let date = new Date();
    for (let i = 0; i < 12; i++) {
      options.push(date);
      date = subMonths(date, 1);
    }
    return options.reverse();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Branch Claims</h1>
        <p className="text-muted-foreground">Review and approve revenue claims from branch directors</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Pending Approval
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Claim History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="card-elevated p-6">
            <CardTitle className="mb-6 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-600" />
              Claims Awaiting Approval
            </CardTitle>
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
                  {claims.filter(c => c.status === 'pending').length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No pending claims.</TableCell></TableRow>
                  ) : (
                    claims.filter(c => c.status === 'pending').map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-bold">{(claim as any).branches?.name}</TableCell>
                        <TableCell>{(claim as any).staff?.full_name}</TableCell>
                        <TableCell className="text-lg font-bold text-blue-700">KES {Number(claim.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => { setSelectedClaim(claim); setApprovalNotes(""); setApprovalDialogOpen(true); }} className="bg-primary">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Approve
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
            <CardTitle className="mb-6 flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              All Claims
            </CardTitle>
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
                      <TableCell>{(claim as any).branches?.name}</TableCell>
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

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Approve Branch Claim</DialogTitle>
            <DialogDescription>
              Verify and approve the revenue claim for {(selectedClaim as any)?.branches?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <Label className="text-xs text-blue-600 uppercase font-bold">Claim Amount</Label>
              <div className="text-2xl font-bold text-blue-900">KES {Number(selectedClaim?.amount).toLocaleString()}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approvalNotes">Approval Notes (Optional)</Label>
              <Textarea
                id="approvalNotes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g., Verified against monthly revenue report"
              />
            </div>
            <Button onClick={handleApproveClaim} className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Approve & Send to Finance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}