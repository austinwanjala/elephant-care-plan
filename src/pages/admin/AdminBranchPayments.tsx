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
import { DollarSign, CheckCircle, Loader2, History } from "lucide-react";
import { format, getMonth, getYear, subMonths, addMonths } from "date-fns";

interface BranchClaim {
  id: string;
  branch_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  period_start: string;
  period_end: string;
  notes: string | null;
  created_at: string;
  branches?: { name: string };
}

export default function AdminBranchPayments() {
  const [claims, setClaims] = useState<BranchClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("branch_claims")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading claims:", error);
      toast({
        title: "Error loading claims",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
    } else {
      setClaims(data || []);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (claimId: string, newStatus: string) => {
    setApproving(claimId);
    try {
      const { error } = await supabase
        .from("branch_claims")
        .update({ status: newStatus })
        .eq("id", claimId);

      if (error) throw error;

      toast({ title: "Updated", description: `Claim marked as ${newStatus}.` });
      loadClaims();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Branch Claims & Payments</h1>
        <p className="text-muted-foreground">Manage compensation requests from branch directors.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Claims History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4">No claims found.</TableCell></TableRow>
              ) : (
                claims.map(claim => (
                  <TableRow key={claim.id}>
                    <TableCell>{format(new Date(claim.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{claim.branches?.name || 'Unknown'}</TableCell>
                    <TableCell>KES {claim.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(claim.period_start), 'MMM d')} - {format(new Date(claim.period_end), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={claim.status === 'paid' ? 'default' : claim.status === 'pending' ? 'secondary' : 'outline'}
                        className={claim.status === 'paid' ? 'bg-green-600' : ''}>
                        {claim.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right gap-2 flex justify-end">
                      {claim.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(claim.id, 'rejected')} disabled={!!approving}>
                            Reject
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(claim.id, 'paid')} disabled={!!approving}>
                            {approving === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Paid"}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}