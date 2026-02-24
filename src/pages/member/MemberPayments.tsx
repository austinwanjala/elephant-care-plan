import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CreditCard, Phone, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { kopokopoService } from "@/services/kopokopo";

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  status: string | null;
  payment_date: string | null;
  mpesa_reference: string | null;
  mpesa_code: string | null;
  reference: string | null;
  kopo_resource_id: string | null;
  created_at: string;
}

export default function MemberPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();
  const [memberId, setMemberId] = useState<string | null>(null);

  const fetchPayments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("members")
      .select("id, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      setLoading(false);
      return;
    }

    setMemberId(member.id);
    if (!phoneNumber) setPhoneNumber(member.phone);

    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    setPayments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleKopoKopoPayment = async () => {
    if (!amount || !phoneNumber || !memberId) {
      toast({ title: "Error", description: "Please enter amount and phone number", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const response = await kopokopoService.initiateStkPush({
        amount: parseFloat(amount),
        phone: phoneNumber,
        memberId: memberId,
        coverageAmount: parseFloat(amount),
        paymentType: "Manual Top-up",
        invoiceNumber: `TOPUP-${Date.now()}`
      });

      const resourceId = response.resource_id;

      toast({
        title: "Payment Initiated",
        description: "Please check your phone for the M-Pesa STK push prompt.",
      });

      // Listen for payment status updates via Realtime
      const channel = supabase
        .channel('topup-status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payments',
            filter: `kopo_resource_id=eq.${resourceId}`
          },
          (payload) => {
            if (payload.new.status === 'completed') {
              toast({
                title: "Payment Successful",
                description: `KES ${parseFloat(amount).toLocaleString()} has been added to your coverage.`,
              });
              channel.unsubscribe();
              setProcessing(false);
              setPayDialogOpen(false);
              setAmount("");
              fetchPayments();
            } else if (payload.new.status === 'failed') {
              toast({
                title: "Payment Failed",
                description: "The payment request was cancelled or failed.",
                variant: "destructive"
              });
              setProcessing(false);
              channel.unsubscribe();
            }
          }
        )
        .subscribe();

      // Fallback polling + Remote Verification
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 30) {
          clearInterval(interval);
          return;
        }

        // Periodically trigger a remote status check to force a DB update if the webhook was missed
        if (attempts % 3 === 0) {
          await kopokopoService.checkStatus(resourceId).catch(console.error);
        }

        const { data: payment } = await supabase
          .from("payments")
          .select("status")
          .eq("kopo_resource_id", resourceId)
          .single();

        if (payment?.status === 'completed') {
          clearInterval(interval);
          fetchPayments();
          setPayDialogOpen(false);
          setProcessing(false);
          setAmount("");
        } else if (payment?.status === 'failed') {
          clearInterval(interval);
          setProcessing(false);
        }
      }, 4000);

    } catch (error: any) {
      toast({ title: "Request Failed", description: error.message, variant: "destructive" });
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-600 hover:bg-green-500/20";
      case "pending": return "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20";
      case "failed": return "bg-red-500/10 text-red-600 hover:bg-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Payments & Contributions</h1>
          <p className="text-muted-foreground">Manage your account coverage.</p>
        </div>
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#49B249] hover:bg-[#3d943d] text-white shadow-lg transition-all hover:scale-105">
              <Phone className="mr-2 h-4 w-4" /> Pay with M-Pesa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md border-t-4 border-[#49B249]">
            <DialogHeader className="flex flex-col items-center justify-center pb-4 border-b">
              <div className="w-16 h-16 bg-[#49B249] rounded-full flex items-center justify-center mb-2 shadow-inner">
                <span className="text-white font-bold text-2xl tracking-tighter italic">M</span>
              </div>
              <DialogTitle className="text-2xl font-bold text-[#49B249]">M-Pesa Payment</DialogTitle>
              <DialogDescription className="text-center">
                Fast, secure payment via Lipa Na M-Pesa STK Push.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>M-Pesa Phone Number</Label>
                <Input
                  placeholder="2547..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="p-4 bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg flex gap-3 italic">
                <div className="bg-[#49B249] p-1.5 rounded-full h-fit mt-0.5">
                  <ShieldCheck className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold mb-0.5">Secure Transaction</p>
                  <p className="text-xs opacity-90">Unlock your phone after clicking "Send" to enter your M-Pesa PIN.</p>
                </div>
              </div>
            </div>

            <DialogFooter className="sm:justify-center pt-2">
              <Button
                onClick={handleKopoKopoPayment}
                disabled={processing}
                className="w-full bg-[#49B249] hover:bg-[#3d943d] text-white text-lg h-12 rounded-xl font-bold shadow-md transition-all active:scale-95"
              >
                {processing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  <>Send STK Push Prompt</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">No payment history found</p>
            <p className="text-sm text-muted-foreground mt-1">Make your first contribution to activate coverage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment) => (
            <Card key={payment.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${payment.status === 'completed' ? 'bg-[#49B249]/10 text-[#49B249]' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {payment.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-lg">KES {payment.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        Coverage: <span className="text-[#49B249] font-medium">+KES {payment.coverage_added.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge className={`mb-2 ${getStatusColor(payment.status)}`}>
                      {payment.status === 'completed' ? 'Successful' : payment.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground font-mono">
                      {format(new Date(payment.payment_date || payment.created_at), "MMM d, yyyy • HH:mm")}
                    </div>
                    {(payment.mpesa_code || payment.reference || payment.mpesa_reference || payment.kopo_resource_id) && (
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono bg-slate-50 px-2 py-0.5 rounded inline-block">
                        Ref: {payment.mpesa_code || payment.reference || payment.mpesa_reference || payment.kopo_resource_id}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}