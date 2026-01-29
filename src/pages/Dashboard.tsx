import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  CreditCard,
  Shield,
  History,
  LogOut,
  Loader2,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  total_contributions: number;
  benefit_limit: number;
  qr_code_data: string;
  membership_categories: { name: string; benefit_amount: number } | null;
}

interface Visit {
  id: string;
  benefit_deducted: number;
  created_at: string;
  notes: string | null;
  services: { name: string } | null;
  branches: { name: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  mpesa_reference: string | null;
  status: string;
  payment_date: string;
}

const Dashboard = () => {
  const [member, setMember] = useState<Member | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    await Promise.all([
      loadMemberData(user.id),
      loadVisits(user.id),
      loadPayments(user.id),
    ]);
    setLoading(false);
  };

  const loadMemberData = async (userId: string) => {
    const { data } = await supabase
      .from("members")
      .select("*, membership_categories(name, benefit_amount)")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      setMember(data);
    }
  };

  const loadVisits = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data } = await supabase
        .from("visits")
        .select("*, services(name), branches(name)")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false });
      
      if (data) setVisits(data);
    }
  };

  const loadPayments = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false });
      
      if (data) setPayments(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl">🐘</span>
            </div>
            <span className="text-xl font-serif font-bold text-foreground">Elephant Dental</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground hidden sm:block">
              Welcome, {member?.full_name}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage Balance</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                KES {member?.coverage_balance?.toLocaleString() || 0}
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
              <p className="text-xs text-muted-foreground">
                Total Contributions: KES {member?.total_contributions?.toLocaleString() || 0}
              </p>
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
          {/* Insurance Card */}
          <div className="lg:col-span-1">
            <div className="qr-card">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🐘</span>
                </div>
                <h3 className="font-serif font-bold text-foreground text-lg mb-1">
                  {member?.full_name}
                </h3>
                <p className="text-primary font-mono font-semibold mb-2">
                  {member?.member_number}
                </p>
                {member?.membership_categories && (
                  <Badge className="mb-4">{member.membership_categories.name}</Badge>
                )}
                
                <div className="bg-background rounded-xl p-4 inline-block mb-4">
                  {member?.qr_code_data && (
                    <QRCodeSVG
                      value={member.qr_code_data}
                      size={140}
                      level="H"
                      includeMargin
                    />
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  Scan at any branch for instant service
                </p>
              </div>
            </div>
          </div>

          {/* History Tables */}
          <div className="lg:col-span-2 space-y-8">
            {/* Service History */}
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
                              -KES {visit.benefit_deducted.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
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

export default Dashboard;
