import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  Shield,
  History,
  Loader2,
  FileText,
  AlertCircle,
  DollarSign,
  Users,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { InsuranceCard } from "@/components/member/InsuranceCard";

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  total_contributions: number;
  benefit_limit: number;
  qr_code_data: string | null;
  is_active: boolean;
  membership_categories: { name: string; benefit_amount: number } | null;
  id_number: string;
  marketers?: { full_name: string; code: string } | null;
}

interface Visit {
  id: string;
  created_at: string;
  notes: string | null;
  services: { name: string } | null;
  branches: { name: string } | null;
  bills: { total_benefit_cost: number }[] | null;
}

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  mpesa_reference: string | null;
  status: string;
  payment_date: string;
}

interface Dependant {
  id: string;
  full_name: string;
  relationship: string;
  id_number: string;
}

const MemberDashboard = () => {
  const [member, setMember] = useState<Member | null>(null);
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadMemberData();
  }, []);

  const loadMemberData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      setLoading(false);
      return;
    }

    await Promise.all([
      fetchMemberProfile(user.id),
      fetchVisits(user.id),
      fetchPayments(user.id),
      fetchDependants(user.id),
    ]);
    setLoading(false);
  };

  const fetchMemberProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("members")
      .select("*, membership_categories(name, benefit_amount), marketers(full_name, code)")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching member profile:", error);
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
      setMember(null);
    } else if (data) {
      setMember(data);
    }
  };

  const fetchDependants = async (userId: string) => {
    const { data: memberData } = await supabase.from("members").select("id").eq("user_id", userId).single();
    if (memberData) {
      const { data } = await supabase.from("dependants").select("*").eq("member_id", memberData.id);
      if (data) setDependants(data);
    }
  }

  const fetchVisits = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data, error } = await supabase
        .from("visits")
        .select("*, services(name), branches(name), bills(total_benefit_cost)")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false });

      if (data) {
        setVisits(data as any);
      }
    }
  };

  const fetchPayments = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false });

      if (error) {
      } else if (data) {
        setPayments(data);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const coveragePercentage = member?.benefit_limit
    ? (member.coverage_balance / member.benefit_limit) * 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Member Profile Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't load your member profile. Please contact support.
            </p>
            <Button onClick={() => navigate("/login")} className="btn-primary">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!member.is_active) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="card-elevated p-8 text-center max-w-lg mx-auto">
          <CardHeader className="flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-accent mb-4" />
            <CardTitle className="text-2xl font-serif font-bold text-foreground mb-2">
              Membership Uncovered
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your membership is currently inactive. Please make your first payment to activate your dental coverage and access services.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/scheme-selection">
              <Button size="lg" className="btn-primary mt-4">
                <DollarSign className="mr-2 h-5 w-5" /> Select Scheme & Pay
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage Balance</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-success">
                  KES {member?.coverage_balance?.toLocaleString() || 0}
                </div>
                {member.is_active ? (
                  <Badge className="bg-success">Covered</Badge>
                ) : (
                  <Badge variant="destructive">Uncovered</Badge>
                )}
              </div>
              <div className="mt-2">
                <Progress value={coveragePercentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {coveragePercentage.toFixed(0)}% of KES {member?.benefit_limit?.toLocaleString() || 0} remaining
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membership</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {member?.membership_categories?.name || "N/A"}
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-xs text-muted-foreground">
                  Total Contributions: KES {member?.total_contributions?.toLocaleString() || 0}
                </p>
                {member?.marketers && (
                  <p className="text-xs font-medium text-primary">
                    Referred by: {member.marketers.full_name} ({member.marketers.code})
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services Used</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visits.length}</div>
              <p className="text-xs text-muted-foreground">
                Total dental services received
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            {member && <InsuranceCard member={{
              full_name: member.full_name,
              member_number: member.member_number,
              membership_categories: member.membership_categories,
              qr_code_data: member.qr_code_data,
              is_active: member.is_active,
              coverage_balance: member.coverage_balance || 0,
              benefit_limit: member.benefit_limit || 0,
              id_number: member.id_number,
            }} />}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Dependants
                </CardTitle>
                <Link to="/dashboard/dependants">
                  <Button variant="outline" size="sm">Manage</Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dependants.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No dependants registered.</p>
                  ) : (
                    dependants.map((dep, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{dep.full_name}</p>
                          <p className="text-xs text-muted-foreground">{dep.relationship}</p>
                        </div>
                        <Badge variant="outline">{dep.id_number}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Service History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No services yet. Visit any branch for dental care!
                          </TableCell>
                        </TableRow>
                      ) : (
                        visits.map((visit) => (
                          <TableRow key={visit.id}>
                            <TableCell>
                              {new Date(visit.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{visit.services?.name || "N/A"}</TableCell>
                            <TableCell>{visit.branches?.name || "N/A"}</TableCell>
                            <TableCell className="text-destructive">
                              -KES {visit.bills?.[0]?.total_benefit_cost?.toLocaleString() || 0}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Coverage Added</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No payment records
                          </TableCell>
                        </TableRow>
                      ) : (
                        payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-success">
                              +KES {payment.coverage_added.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {payment.mpesa_reference || "N/A"}
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberDashboard;