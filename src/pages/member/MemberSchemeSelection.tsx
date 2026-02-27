import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, AlertCircle } from "lucide-react";
import { kopokopoService } from "@/services/kopokopo";

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
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MembershipCategory | null>(null);
  const [allCategories, setAllCategories] = useState<MembershipCategory[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchMemberAndCategories();
  }, []);

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

  const handleKopoKopoPayment = async (e: React.FormEvent) => {
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
      // Save scheme selection before initiating payment
      const { error: schemeErr } = await supabase
        .from("members")
        .update({
          membership_category_id: selectedCategory.id,
          scheme_selected: true,
        })
        .eq("id", member.id);

      if (schemeErr) throw schemeErr;

      const totalPaymentAmount = selectedCategory.payment_amount + selectedCategory.registration_fee + selectedCategory.management_fee;

      const response = await kopokopoService.initiateStkPush({
        amount: totalPaymentAmount,
        phone: phoneNumber,
        memberId: member.id,
        coverageAmount: selectedCategory.benefit_amount,
        paymentType: "Scheme Activation",
        invoiceNumber: `SCHEME-${Date.now()}`
      });

      const resourceId = response.resource_id;

      toast({
        title: "Payment Initiated",
        description: "Please check your phone for the M-Pesa STK push prompt.",
      });

      // Listen for payment status updates via Realtime
      const channel = supabase
        .channel('payment-status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payments',
            filter: `kopo_resource_id=eq.${resourceId}`
          },
          (payload) => {
            console.log("Payment update received:", payload.new);
            if (payload.new.status === 'completed') {
              toast({
                title: "Payment Successful",
                description: `Your ${selectedCategory.name} membership is now active.`,
              });
              channel.unsubscribe();
              navigate("/dashboard");
            } else if (payload.new.status === 'failed') {
              toast({
                title: "Payment Failed",
                description: "The payment request was cancelled or failed. Please try again.",
                variant: "destructive"
              });
              setSubmitting(false);
              channel.unsubscribe();
            }
          }
        )
        .subscribe();

      // Optional: Polling fallback for safety
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 30) { // 2 minutes max
          clearInterval(interval);
          return;
        }

        const { data: payment } = await (supabase as any)
          .from("payments")
          .select("status")
          .eq("kopo_resource_id", resourceId)
          .single();

        if (payment?.status === 'completed') {
          clearInterval(interval);
          toast({ title: "Payment Verified", description: "Your scheme is now active!" });
          navigate("/dashboard");
        } else if (payment?.status === 'failed') {
          clearInterval(interval);
          setSubmitting(false);
        }
      }, 4000);

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
          <form onSubmit={handleKopoKopoPayment} className="space-y-6">
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

                <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-md flex gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p><b>Live Mode:</b> Scheme will be activated once payment is confirmed via M-Pesa.</p>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberSchemeSelection;