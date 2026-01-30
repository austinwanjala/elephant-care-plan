import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FileText, PlusCircle, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  branches: { name: string } | null;
}

export default function MemberClaimsList() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMemberAndClaims();
  }, []);

  const fetchMemberAndClaims = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      toast({
        title: "Error loading member data",
        description: memberError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (memberData) {
      setMemberId(memberData.id);
      const { data: claimsData, error: claimsError } = await supabase
        .from("claims")
        .select("*, branches(name)")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false });

      if (claimsError) {
        toast({
          title: "Error loading claims",
          description: claimsError.message,
          variant: "destructive",
        });
      } else {
        setClaims(claimsData || []);
      }
    } else {
      toast({
        title: "Member profile not found",
        description: "Please contact support.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
    setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!memberId) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground">Could not load member claims. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Claims</h1>
          <p className="text-muted-foreground">View your submitted dental claims</p>
        </div>
        <Link to="/dashboard/claims/new">
          <Button className="btn-primary">
            <PlusCircle className="mr-2 h-4 w-4" /> Submit New Claim
          </Button>
        </Link>
      </div>

      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Claims
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No claims submitted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  claims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>{format(new Date(claim.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{claim.branches?.name || "N/A"}</TableCell>
                      <TableCell>{claim.treatment}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{claim.diagnosis}</TableCell>
                      <TableCell>KES {claim.amount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}