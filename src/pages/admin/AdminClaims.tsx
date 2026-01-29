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

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  members: { full_name: string; member_number: string } | null;
  branches: { name: string } | null;
  staff: { full_name: string } | null;
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
      .select("*, members(full_name, member_number), branches(name), staff(full_name)")
      .order("created_at", { ascending: false });

    if (data) setClaims(data);
  };

  const handleUpdateStatus = async (claimId: string, status: "completed" | "rejected") => {
    try {
      const { error } = await supabase
        .from("claims")
        .update({ status, processed_at: new Date().toISOString() })
        .eq("id", claimId);

      if (error) throw error;

      toast({ title: `Claim ${status}` });
      loadClaims();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
                            onClick={() => handleUpdateStatus(claim.id, "completed")}
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
