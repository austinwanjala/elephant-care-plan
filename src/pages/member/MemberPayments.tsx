import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CreditCard, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { mpesaService } from "@/services/mpesa";

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  status: string | null;
  payment_date: string | null;
  mpesa_reference: string | null;
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

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        () => {
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleMpesaPayment = async () => {
    if (!amount || !phoneNumber || !memberId) {
      toast({ title: "Error", description: "Please enter amount and phone number", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      await mpesaService.initiateStkPush({
        amount: parseFloat(amount),
        phone: phoneNumber.replace("+", ""),
        member_id: memberId,
        coverage_amount: parseFloat(amount)
      });

      toast({
        title: "Request Sent",
        description: "Please check your phone to complete the M-Pesa payment."
      });
      setPayDialogOpen(false);
    } catch (error: any) {
      console.error("Payment error:", error);
      
      // Try to extract the error message from the function response
      let errorMessage = "Could not initiate payment. Please try again.";
      if (error.message) {
          try {
              const parsed = JSON.parse(error.message);
              errorMessage = parsed.error || errorMessage;
          } catch (e) {
              errorMessage = error.message;
          }
      }

      toast({ 
        title: "Payment Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
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
            <Button className="bg-green-600 hover:bg-green-700">
              <CreditCard className="mr-2 h-4 w-4" /> Add Funds (M-Pesa)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>M-Pesa Payment</DialogTitle>
              <DialogDescription>
                Enter amount to top up your coverage balance.
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
              <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-md flex gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>A prompt will be sent to your phone. Enter your M-Pesa PIN to complete the transaction.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleMpesaPayment} disabled={processing} className="bg-green-600 hover:bg-green-700">
                {processing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Phone className="mr-2 h-4 w-4" />}
                Send Request
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
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${payment.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {payment.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-lg">KES {payment.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        Coverage: <span className="text-green-600 font-medium">+KES {payment.coverage_added.toLocaleString()}</span>
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
                    {payment.mpesa_reference && (
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono bg-slate-50 px-2 py-0.5 rounded inline-block">
                        Ref: {payment.mpesa_reference}
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