import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  CreditCard,
  Shield,
  History,
  LogOut,
  Loader2,
  Phone,
  FileText,
  Download,
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

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  total_contributions: number;
  qr_code_data: string;
}

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  mpesa_reference: string | null;
  status: string;
  payment_date: string;
}

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  branches: { name: string } | null;
}

const Dashboard = () => {
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("500");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
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
      loadPayments(user.id),
      loadClaims(user.id),
    ]);
    setLoading(false);
  };

  const loadMemberData = async (userId: string) => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      setMember(data);
      setPaymentPhone(data.phone);
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

  const loadClaims = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data } = await supabase
        .from("claims")
        .select("*, branches(name)")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false });
      
      if (data) setClaims(data);
    }
  };

  const handlePayment = async () => {
    if (!member) return;
    const amount = parseFloat(paymentAmount);
    if (amount < 500) {
      toast({
        title: "Invalid amount",
        description: "Minimum contribution is KES 500",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // Simulate M-Pesa STK Push (mock for now)
      const mockReference = `MPE${Date.now()}`;
      
      // Create payment record
      const { error } = await supabase.from("payments").insert({
        member_id: member.id,
        amount: amount,
        coverage_added: amount * 2,
        mpesa_reference: mockReference,
        phone_used: paymentPhone,
        status: "completed",
      });

      if (error) throw error;

      toast({
        title: "Payment successful!",
        description: `KES ${amount} paid. KES ${amount * 2} added to your coverage.`,
      });

      setPaymentDialogOpen(false);
      // Reload data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await loadMemberData(user.id);
        await loadPayments(user.id);
      }
    } catch (error: any) {
      toast({
        title: "Payment failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      completed: "badge-success",
      pending: "badge-warning",
      failed: "badge-error",
      approved: "badge-success",
      rejected: "badge-error",
    };
    return badges[status] || "badge-warning";
  };

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
          <div className="stat-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Coverage Balance</p>
                <p className="text-2xl font-bold text-foreground">
                  KES {member?.coverage_balance?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Contributions</p>
                <p className="text-2xl font-bold text-foreground">
                  KES {member?.total_contributions?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Claims</p>
                <p className="text-2xl font-bold text-foreground">{claims.length}</p>
              </div>
            </div>
          </div>
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
                <p className="text-primary font-mono font-semibold mb-4">
                  {member?.member_number}
                </p>
                
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

                <p className="text-sm text-muted-foreground mb-4">
                  Scan at any branch for instant service
                </p>

                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full btn-primary">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Coverage
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Make a Contribution</DialogTitle>
                      <DialogDescription>
                        Pay via M-Pesa and get 2× coverage instantly
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (KES)</Label>
                        <Input
                          id="amount"
                          type="number"
                          min="500"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="input-field"
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum: KES 500
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">M-Pesa Phone</Label>
                        <Input
                          id="phone"
                          placeholder="0712345678"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          className="input-field"
                        />
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">You pay:</span>
                          <span className="font-semibold">KES {parseInt(paymentAmount || "0").toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Coverage added:</span>
                          <span className="font-semibold text-success">
                            KES {(parseInt(paymentAmount || "0") * 2).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={handlePayment}
                        disabled={processingPayment}
                        className="w-full btn-accent"
                      >
                        {processingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Phone className="mr-2 h-4 w-4" />
                            Pay with M-Pesa
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* History Tables */}
          <div className="lg:col-span-2 space-y-8">
            {/* Payments */}
            <div className="card-elevated overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment History
                </h2>
              </div>
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
                          No payments yet. Make your first contribution!
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((payment) => (
                        <TableRow key={payment.id} className="table-row-hover">
                          <TableCell>
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-success">
                            +KES {payment.coverage_added.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {payment.mpesa_reference}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(payment.status)}`}>
                              {payment.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Claims */}
            <div className="card-elevated overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Claim History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No claims yet. Visit any branch for dental services!
                        </TableCell>
                      </TableRow>
                    ) : (
                      claims.map((claim) => (
                        <TableRow key={claim.id} className="table-row-hover">
                          <TableCell>
                            {new Date(claim.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{claim.branches?.name || "N/A"}</TableCell>
                          <TableCell>{claim.diagnosis}</TableCell>
                          <TableCell className="text-destructive">
                            -KES {claim.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(claim.status)}`}>
                              {claim.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
