import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  member_id: string; // Added for logic
  branch_id: string; // Added for logic
  notes: string | null; // Added for logic
  members: { full_name: string; member_number: string; coverage_balance: number | null } | null;
  branches: { name: string } | null;
  staff: { full_name: string } | null;
}

interface Service {
  id: string;
  name: string;
  benefit_cost: number;
  branch_compensation: number;
  profit_loss: number;
}

export default function AdminClaims() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    const { data } = await supabase
      .from("claims")
      .select("*, members(full_name, member_number, coverage_balance), branches(name), staff(full_name)")
      .order("created_at", { ascending: false });

    if (data) setClaims(data);
  };

  const handleUpdateStatus = async (claimId: string, status: "approved" | "rejected") => {
    try {
      const { data: claimToUpdate, error: fetchClaimError } = await supabase
        .from("claims")
        .select("*, members(coverage_balance)")
        .eq("id", claimId)
        .single();

      if (fetchClaimError) throw fetchClaimError;
      if (!claimToUpdate) throw new Error("Claim not found.");

      if (status === "approved") {
        const { data: serviceData, error: fetchServiceError } = await supabase
          .from("services")
          .select("id, name, benefit_cost") // Only need benefit_cost for initial check
          .eq("name", claimToUpdate.treatment)
          .single();

        if (fetchServiceError) throw fetchServiceError;
        if (!serviceData) throw new Error(`Service '${claimToUpdate.treatment}' not found.`);

        const memberCurrentCoverage = claimToUpdate.members?.coverage_balance || 0;
        if (memberCurrentCoverage < serviceData.benefit_cost) {
          toast({
            title: "Approval Failed",
            description: `Member has insufficient coverage (KES ${memberCurrentCoverage.toLocaleString()}) for this service (KES ${serviceData.benefit_cost.toLocaleString()}). Claim rejected.`,
            variant: "destructive",
          });
          // Automatically reject if coverage is insufficient
          await supabase
            .from("claims")
            .update({ status: "rejected", processed_at: new Date().toISOString() })
            .eq("id", claimId);
          loadClaims();
          return;
        }

        // Get current admin's staff_id if available
        const { data: { user } } = await supabase.auth.getUser();
        let staffId: string | null = null;
        if (user) {
          const { data: staffProfile } = await supabase
            .from("staff")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          staffId = staffProfile?.id || null;
        }

        // Only update claim status to 'approved' and set processed_at
        const { error: updateClaimError } = await supabase
          .from("claims")
          .update({ status: "approved", processed_at: new Date().toISOString(), staff_id: staffId })
          .eq("id", claimId);
        if (updateClaimError) throw updateClaimError;

        toast({ title: `Claim approved, awaiting member visit at branch.` });

      } else if (status === "rejected") {
        const { error: updateClaimError } = await supabase
          .from("claims")
          .update({ status, processed_at: new Date().toISOString() })
          .eq("id", claimId);
        if (updateClaimError) throw updateClaimError;
        toast({ title: `Claim rejected.` });
      }

      loadClaims(); // Reload claims to reflect changes
    } catch (error: any) {
      console.error("Error processing claim:", error);
      toast({
        title: "Error processing claim",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "approved": // New status badge
        return <Badge className="bg-blue-500/10 text-blue-600">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Claims</h1>
          <p className="text-muted-foreground">Review and manage member claims</p>
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
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
                    <TableCell>{claim.branches?.name || "N/A"}</TableCell>
                    <TableCell>{claim.staff?.full_name || "N/A"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{claim.diagnosis}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{claim.treatment}</TableCell>
                    <TableCell>KES {claim.amount.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell>
                      {claim.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-success hover:text-success"
                            onClick={() => handleUpdateStatus(claim.id, "approved")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleUpdateStatus(claim.id, "rejected")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {claims.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No claims found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}