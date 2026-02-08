import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CheckCircle, DollarSign, RefreshCw, Search } from "lucide-react";
import { mpesaService } from "@/services/mpesa";

interface MemberInfo {
  id: string;
  full_name: string;
  phone: string;
  coverage_balance: number;
  total_contributions: number;
  benefit_limit: number;
  membership_category_id: string | null;
  is_active: boolean;
  member_number: string;
}

interface MembershipCategory {
  id: string;
  name: string;
  payment_amount: number;
  benefit_amount: number;
  registration_fee: number;
  management_fee: number;
  level: string;
}

const MemberSchemeSelection = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [waitingForCallback, setWaitingForCallback] = useState(false);
  const [currentCheckoutId, setCurrentCheckoutId] = useState<string | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MembershipCategory | null>(null);
  const [allCategories, setAllCategories] = useState<MembershipCategory[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const channelRef = useRef<any>(null);
  const pollingIntervalRef = useRef<any>(null);

  useEffect(() => {
    fetchMemberAndCategories();
    return () => {
      stopVerification();
    };
  }, []);

  const stopVerification = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const fetchMemberAndCategories = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, full_name, phone, coverage_balance, total_contributions, benefit_limit, membership_category_id, is_active, member_number")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      toast({ title: "Error loading member data", description: memberError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!memberData) {
      toast({ title: "Member profile not found", description: "Please contact support.", variant: "destructive" });
      navigate("/dashboard");
      return;
    }

    setMember(memberData);
    setPhoneNumber(memberData.phone);

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("membership_categories")
      .select("*")
      .eq("is_active", true)
      .order("level", { ascending: true });

    if (categoriesError) {
      toast({ title: "Error loading membership categories", description: categoriesError.message, variant: "destructive" });
    } else if (categoriesData) {
      setAllCategories(categoriesData);
    }

    setLoading(false);
  };

  const handleManualCheck = async () => {
    if (!currentCheckoutId) return;
    try {
      const payment = await mpesaService.checkPaymentStatus(currentCheckoutId);
      if (payment && payment.status !== 'pending') {
        handlePaymentResult(payment);
      }
    } catch (err) {
      console.error("Manual check error:", err);
    }
  };

  const handlePaymentResult = async (payment: any) => {
    if (payment.status === 'completed') {
      toast({ title: "Payment Confirmed!", description: "Your membership scheme has been activated." });

      if (member && selectedCategory) {
        await supabase.from("members").update({
          membership_category_id: selectedCategory.id,
          is_active: true,
          benefit_limit: (member.benefit_limit || 0) + selectedCategory.benefit_amount
        }).eq("id", member.id);
      }

      stopVerification();
      setWaitingForCallback(false);
      navigate("/dashboard");
    } else if (payment.status === 'failed') {
      toast({
        title: "Payment Failed",
        description: payment.mpesa_result_desc || "Transaction was cancelled or failed.",
        variant: "destructive"
      });
      stopVerification();
      setWaitingForCallback(false);
      setSubmitting(false);
      setCurrentCheckoutId(null);
    }
  };

  const handleMpesaPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || !selectedCategory) {
      toast({ title: "Selection Required", description: "Please select a membership scheme.", variant: "destructive" });
      return;
    }
    if (!phoneNumber) {
      toast({ title: "Phone Required", description: "Please enter your M-Pesa phone number.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const totalPayment = selectedCategory.payment_amount + selectedCategory.registration_fee + selectedCategory.management_fee;

      const response = await mpesaService.initiateStkPush({
        amount: totalPayment,
        phone: phoneNumber.replace("+", ""),
        member_id: member.id,
        coverage_amount: selectedCategory.benefit_amount
      });

      const checkoutId = response.CheckoutRequestID;
      setCurrentCheckoutId(checkoutId);

      toast({
        title: "Request Sent",
        description: `Please check your phone to pay KES ${totalPayment.toLocaleString()}.`,
      });

      setWaitingForCallback(true);

      // 1. Realtime Subscription
      channelRef.current = mpesaService.subscribeToCheckoutStatus(checkoutId, (payload) => {
        handlePaymentResult(payload);
      });

      // 2. Polling Fallback
      pollingIntervalRef.current = setInterval(() => {
        handleManualCheck();
      }, 3000);

    } catch (error: any) {
      toast({ title: "Request Failed", description: error.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPayment = selectedCategory
    ? selectedCategory.payment_amount + selectedCategory.registration_fee + selectedCategory.management_fee
    : 0;

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <Card className="card-elevated p-8">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-serif font-bold text-foreground mb-2">
            {member?.is_active ? "Renew or Upgrade Coverage" : "Select Your Membership Scheme"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a scheme level and pay via M-Pesa to activate.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {waitingForCallback ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <RefreshCw className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-xl">Verifying Your Payment...</h3>
                <p className="text-muted-foreground">
                  We've sent a prompt to <strong>{phoneNumber}</strong> for <strong>KES {totalPayment.toLocaleString()}</strong>. 
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleManualCheck} 
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Check Status Now
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMpesaPayment} className="space-y-6">
              <div className="space-y-4">
                <Label>Membership Scheme</Label>
                <div className="grid gap-3">
                  {allCategories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedCategory?.id === cat.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/50"
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">{cat.name} ({cat.level.replace('_', ' ')})</span>
                        <span className="text-primary font-bold">KES {(cat.payment_amount + cat.registration_fee + cat.management_fee).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Benefit: KES {cat.benefit_amount.toLocaleString()} | Fees: KES {(cat.registration_fee + cat.management_fee).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCategory && (
                <>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-primary">Payment Summary for {selectedCategory.name}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Membership Payment:</span>
                        <span>KES {selectedCategory.payment_amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Registration Fee:</span>
                        <span>KES {selectedCategory.registration_fee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Management Fee:</span>
                        <span>KES {selectedCategory.management_fee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-primary col-span-2 border-t pt-2">
                        <span>Total Payable (M-Pesa):</span>
                        <span>KES {totalPayment.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">M-Pesa Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      placeholder="2547..."
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full btn-primary" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Request...
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Pay & Activate
                      </>
                    )}
                  </Button>
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberSchemeSelection;