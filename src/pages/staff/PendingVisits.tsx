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
import { Button } from "@/components/ui/button";
import { Clock, Loader2, AlertCircle, CheckCircle, Fingerprint, X } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BiometricCapture } from "@/components/BiometricCapture";

interface MemberInfo {
  full_name: string;
  member_number: string;
  coverage_balance: number | null;
  biometric_data: string | null;
}

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  member_id: string;
  branch_id: string;
  notes: string | null;
  members: MemberInfo | null;
  branches: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  benefit_cost: number;
  branch_compensation: number;
  profit_loss: number;
}

interface StaffInfo {
  id: string;
  branch_id: string | null;
  branches: { name: string } | null;
}

export default function PendingVisits() {
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [verificationDialog, setVerificationDialog] = useState<{
    open: boolean;
    claim: Claim | null;
    verified: boolean;
  }>({ open: false, claim: null, verified: false });
  const { toast } = useToast();

  useEffect(() => {
    loadStaffAndClaims();
  }, []);

  const loadStaffAndClaims = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffData } = await supabase
      .from("staff")
      .select("id, branch_id, branches(name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffData?.branch_id) {
      setStaffInfo(staffData);
      const { data, error } = await supabase
        .from("claims")
        .select("*, members(full_name, member_number, coverage_balance, biometric_data), branches(name)")
        .eq("branch_id", staffData.branch_id)
        .eq("status", "approved") // Now fetching 'approved' claims
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error loading pending claims",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setPendingClaims(data || []);
      }
    } else {
      setStaffInfo(staffData); // Set staffInfo even if branch_id is null to trigger the conditional render
      toast({
        title: "Branch not assigned",
        description: "Your staff profile is not assigned to a branch.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const openVerificationDialog = (claim: Claim) => {
    setVerificationDialog({ open: true, claim, verified: false });
  };

  const handleVerificationComplete = (success: boolean) => {
    setVerificationDialog(prev => ({ ...prev, verified: success }));
  };

  const handleMarkAsVisited = async (claimId: string) => {
    if (!staffInfo?.id || !staffInfo?.branch_id) {
      toast({
        title: "Action Failed",
        description: "Staff or branch information is missing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: claimToProcess, error: fetchClaimError } = await supabase
        .from("claims")
        .select("*, members(coverage_balance), branches(name)")
        .eq("id", claimId)
        .single();

      if (fetchClaimError) throw fetchClaimError;
      if (!claimToProcess) throw new Error("Claim not found.");

      const { data: serviceData, error: fetchServiceError } = await supabase
        .from("services")
        .select("id, name, benefit_cost, branch_compensation, profit_loss")
        .eq("name", claimToProcess.treatment) // Assuming treatment name matches service name
        .single();

      if (fetchServiceError) throw fetchServiceError;
      if (!serviceData) throw new Error(`Service '${claimToProcess.treatment}' not found.`);

      const memberCurrentCoverage = claimToProcess.members?.coverage_balance || 0;
      if (memberCurrentCoverage < serviceData.benefit_cost) {
        toast({
          title: "Processing Failed",
          description: `Member has insufficient coverage (KES ${memberCurrentCoverage.toLocaleString()}) for this service (KES ${serviceData.benefit_cost.toLocaleString()}). Claim rejected.`,
          variant: "destructive",
        });
        // Automatically reject if coverage is insufficient
        await supabase
          .from("claims")
          .update({ status: "rejected", processed_at: new Date().toISOString() })
          .eq("id", claimId);
        loadStaffAndClaims();
        return;
      }

      // 1. Update claim status to completed
      const { error: updateClaimError } = await supabase
        .from("claims")
        .update({ status: "completed", processed_at: new Date().toISOString(), staff_id: staffInfo.id })
        .eq("id", claimId);
      if (updateClaimError) throw updateClaimError;

      // 2. Insert into visits table
      const { error: insertVisitError } = await supabase.from("visits").insert({
        member_id: claimToProcess.member_id,
        branch_id: claimToProcess.branch_id,
        service_id: serviceData.id,
        staff_id: staffInfo.id,
        benefit_deducted: serviceData.benefit_cost,
        branch_compensation: serviceData.branch_compensation,
        profit_loss: serviceData.profit_loss,
        notes: claimToProcess.notes,
      });
      if (insertVisitError) throw insertVisitError;

      // 3. Update member's coverage balance
      const { error: updateMemberError } = await supabase
        .from("members")
        .update({ coverage_balance: memberCurrentCoverage - serviceData.benefit_cost })
        .eq("id", claimToProcess.member_id);
      if (updateMemberError) throw updateMemberError;

      // 4. Update branch revenue for today
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: existingRevenue, error: fetchRevenueError } = await supabase
        .from("branch_revenue")
        .select("*")
        .eq("branch_id", claimToProcess.branch_id)
        .eq("date", today)
        .maybeSingle();

      if (fetchRevenueError) throw fetchRevenueError;

      if (existingRevenue) {
        const { error: updateRevenueError } = await supabase
          .from("branch_revenue")
          .update({
            visit_count: existingRevenue.visit_count + 1,
            total_compensation: existingRevenue.total_compensation + serviceData.branch_compensation,
            total_benefit_deductions: existingRevenue.total_benefit_deductions + serviceData.benefit_cost,
            total_profit_loss: existingRevenue.total_profit_loss + serviceData.profit_loss,
          })
          .eq("id", existingRevenue.id);
        if (updateRevenueError) throw updateRevenueError;
      } else {
        const { error: insertRevenueError } = await supabase.from("branch_revenue").insert({
          branch_id: claimToProcess.branch_id,
          date: today,
          visit_count: 1,
          total_compensation: serviceData.branch_compensation,
          total_benefit_deductions: serviceData.benefit_cost,
          total_profit_loss: serviceData.profit_loss,
        });
        if (insertRevenueError) throw insertRevenueError;
      }

      toast({ title: `Claim processed and visit recorded!` });
      loadStaffAndClaims(); // Reload claims to reflect changes
    } catch (error: any) {
      console.error("Error processing claim:", error);
      toast({
        title: "Error processing claim",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staffInfo?.branch_id) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Branch Not Assigned
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your staff profile is not assigned to a branch. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Pending Visits</h1>
        <p className="text-muted-foreground">Claims submitted by members awaiting their visit at {staffInfo?.branches?.name}</p>
      </div>

      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Claims Awaiting Visit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No pending claims for your branch.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        {format(new Date(claim.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{claim.members?.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {claim.members?.member_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{claim.diagnosis}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{claim.treatment}</TableCell>
                      <TableCell>KES {claim.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Approved</Badge> {/* Display as Approved */}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="btn-primary"
                          onClick={() => openVerificationDialog(claim)}
                        >
                          <Fingerprint className="mr-2 h-4 w-4" /> Verify & Process
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Biometric Verification Dialog */}
      <Dialog 
        open={verificationDialog.open} 
        onOpenChange={(open) => !open && setVerificationDialog({ open: false, claim: null, verified: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              Biometric Verification
            </DialogTitle>
            <DialogDescription>
              Verify the member's identity before processing this visit.
            </DialogDescription>
          </DialogHeader>

          {verificationDialog.claim && (
            <div className="space-y-4">
              {/* Member Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Member:</span>
                  <span className="font-medium">{verificationDialog.claim.members?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Member #:</span>
                  <span className="font-mono text-sm">{verificationDialog.claim.members?.member_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Treatment:</span>
                  <span className="font-medium">{verificationDialog.claim.treatment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-medium">KES {verificationDialog.claim.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Biometric Verification */}
              <BiometricCapture
                mode="verify"
                credentialId={verificationDialog.claim.members?.biometric_data}
                onVerificationComplete={handleVerificationComplete}
              />

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setVerificationDialog({ open: false, claim: null, verified: false })}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  className="flex-1 btn-primary"
                  disabled={!verificationDialog.verified}
                  onClick={async () => {
                    if (verificationDialog.claim) {
                      await handleMarkAsVisited(verificationDialog.claim.id);
                      setVerificationDialog({ open: false, claim: null, verified: false });
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Process Visit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}