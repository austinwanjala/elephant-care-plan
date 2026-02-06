import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CheckCircle, DollarSign } from "lucide-react";

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
      toast({
        title: "Error loading member data",
        description: memberError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!memberData) {
      toast({
        title: "Member profile not found",
        description: "Please contact support.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setMember(memberData);
    setPhoneNumber(memberData.phone); // Pre-fill with member's phone

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("membership_categories")
      .select("*")
      .eq("is_active", true)
      .order("level", { ascending: true });

    if (categoriesError) {
      toast({
        title: "Error loading membership categories",
        description: categoriesError.message,
        variant: "destructive",
      });
    } else if (categoriesData) {
      setAllCategories(categoriesData);
    }

    setLoading(false);
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
      const principalAmount = selectedCategory.payment_amount;
      const benefitToAdd = selectedCategory.benefit_amount;
      const totalPayment = principalAmount + selectedCategory.registration_fee + selectedCategory.management_fee;

      // 1. Trigger STK Push via Edge Function
      const { error: invokeError } = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          amount: totalPayment,
          phone: phoneNumber.replace("+", ""), // Ensure format
          member_id: member.id,
          coverage_amount: benefitToAdd
        }
      });

      if (invokeError) throw invokeError;

      toast({
        title: "Request Sent to Phone",
        description: `Please check ${phoneNumber} to complete the payment of KES ${totalPayment.toLocaleString()}.`,
      });

      setWaitingForCallback(true);

      // 2. Subscribe to Payment Completion
      // We listen for any INSERT/UPDATE on 'payments' for this member where status becomes 'completed'
      const channel = supabase
        .channel('scheme-payment-verification')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payments',
            filter: `member_id=eq.${member.id}`
          },
          async (payload) => {
            const newRecord = payload.new as any;
            if (newRecord.status === 'completed') {
              // Payment successful!
              toast({
                title: "Payment Confirmed!",
                description: "Your membership scheme has been activated.",
                variant: "default"
              });
              // Activate member in DB if not handled by trigger (Wait, triggers update balance, but setting category might not happen automatically unless we change logic or do it here)
              // Actually, the `process_visit` handles visit logic.
              // The `update_coverage_on_payment` adds coverage.
              // We also need to SET the membership_category_id if it's new.

              // Let's do a quick update to ensure the category is set correctly upon payment success
              await supabase.from("members").update({
                membership_category_id: selectedCategory.id,
                is_active: true,
                benefit_limit: (member.benefit_limit || 0) + benefitToAdd
              }).eq("id", member.id);

              // Also send SMS manually here or relying on trigger? 
              // Trigger is better, but existing logic had it here. Let's keep it safe.
              // Actually, let's just rely on visual callback for now and redirect.

              setWaitingForCallback(false);
              navigate("/dashboard");
              supabase.removeChannel(channel);
            } else if (newRecord.status === 'failed') {
              toast({
                title: "Payment Failed",
                description: newRecord.mpesa_result_desc || "Transaction was cancelled or failed.",
                variant: "destructive"
              });
              setWaitingForCallback(false);
              setSubmitting(false);
              supabase.removeChannel(channel);
            }
          }
        )
        .subscribe();


    } catch (error: any) {
      console.error("M-Pesa Payment Error:", error);

      let errorMessage = error.message || "Could not initiate M-Pesa payment.";

      // Handle potential Edge Function error structure
      if (error && error.context && error.context.status) {
        errorMessage = `Server Error (${error.context.status}): ${errorMessage}`;
      } else if (errorMessage.includes("Failed to send request")) {
        errorMessage = "Could not connect to the server. Please check if the Edge Function is deployed.";
      }

      toast({
        title: "Request Failed",
        description: errorMessage,
        variant: "destructive",
      });
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

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Could not load member details. Please try again later.</p>
        <Button onClick={() => navigate("/login")} className="mt-4">Go to Login</Button>
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
            {member.is_active ? "Renew or Upgrade Coverage" : "Select Your Membership Scheme"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a scheme level and pay via M-Pesa to activate.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <form onSubmit={handleMpesaPayment} className="space-y-6">
            <div className="space-y-4">
              <Label>Membership Scheme</Label>
              <div className="grid gap-3">
                {allCategories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (!waitingForCallback) setSelectedCategory(cat);
                    }}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedCategory?.id === cat.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/50"
                      } ${waitingForCallback ? 'opacity-50 pointer-events-none' : ''}`}
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
                  <div className="flex justify-between font-bold text-success border-t pt-2">
                    <span>Coverage to Add:</span>
                    <span>KES {selectedCategory.benefit_amount.toLocaleString()}</span>
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
                    disabled={waitingForCallback}
                  />
                  <p className="text-xs text-muted-foreground">Enter the phone number that will receive the payment prompt.</p>
                </div>

                <Button type="submit" className="w-full btn-primary" disabled={submitting || waitingForCallback}>
                  {waitingForCallback ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Waiting for Payment...
                    </>
                  ) : submitting ? (
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

                {waitingForCallback && (
                  <div className="text-center text-sm text-yellow-600 animate-pulse">
                    Please check your phone and enter your PIN. Do not leave this page.
                  </div>
                )}
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberSchemeSelection;