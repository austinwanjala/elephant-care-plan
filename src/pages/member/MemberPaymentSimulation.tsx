import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, DollarSign, CheckCircle } from "lucide-react";

interface MemberInfo {
  id: string;
  full_name: string;
  coverage_balance: number;
  total_contributions: number;
  membership_category_id: string;
}

interface MembershipCategory {
  id: string;
  name: string;
  payment_amount: number;
  benefit_amount: number;
  registration_fee: number;
  management_fee: number;
}

const MemberPaymentSimulation = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [membershipCategory, setMembershipCategory] = useState<MembershipCategory | null>(null);
  const [mpesaReference, setMpesaReference] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchMemberAndCategoryData();
  }, []);

  const fetchMemberAndCategoryData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, full_name, coverage_balance, total_contributions, membership_category_id")
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

    if (memberData.membership_category_id) {
      const { data: categoryData, error: categoryError } = await supabase
        .from("membership_categories")
        .select("*")
        .eq("id", memberData.membership_category_id)
        .maybeSingle();

      if (categoryError) {
        toast({
          title: "Error loading membership category",
          description: categoryError.message,
          variant: "destructive",
        });
      } else {
        setMembershipCategory(categoryData);
      }
    } else {
      toast({
        title: "No membership category found",
        description: "Please select a membership category first.",
        variant: "destructive",
      });
      navigate("/dashboard/profile"); // Or to a page where they can select a category
    }

    setLoading(false);
  };

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || !membershipCategory) return;

    setSubmitting(true);

    try {
      const totalPayment = membershipCategory.payment_amount + membershipCategory.registration_fee + membershipCategory.management_fee;
      const benefitToAdd = membershipCategory.benefit_amount;

      // 1. Update member's coverage and contributions
      const { error: updateError } = await supabase
        .from("members")
        .update({
          coverage_balance: member.coverage_balance + benefitToAdd,
          total_contributions: member.total_contributions + totalPayment,
        })
        .eq("id", member.id);

      if (updateError) throw updateError;

      // 2. Record the payment
      const { error: paymentError } = await supabase.from("payments").insert({
        member_id: member.id,
        amount: totalPayment,
        coverage_added: benefitToAdd,
        status: "completed",
        payment_date: new Date().toISOString(),
        mpesa_reference: mpesaReference || `SIMULATED_MPESA_${Date.now()}`,
      });

      if (paymentError) throw paymentError;

      toast({
        title: "Payment Successful!",
        description: `KES ${totalPayment.toLocaleString()} received. KES ${benefitToAdd.toLocaleString()} added to your coverage.`,
      });

      navigate("/dashboard"); // Redirect to dashboard after successful payment
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
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

  if (!member || !membershipCategory) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Could not load member or membership details.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }

  const totalPayment = membershipCategory.payment_amount + membershipCategory.registration_fee + membershipCategory.management_fee;

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <Card className="card-elevated p-8">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-serif font-bold text-foreground mb-2">
            Top Up Coverage
          </CardTitle>
          <p className="text-muted-foreground">
            Make a payment to increase your dental coverage balance.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <form onSubmit={handleSimulatePayment} className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-primary">Payment Summary for {membershipCategory.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Membership:</span>
                  <span>KES {membershipCategory.payment_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Registration Fee:</span>
                  <span>KES {membershipCategory.registration_fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Management Fee:</span>
                  <span>KES {membershipCategory.management_fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-primary col-span-2 border-t pt-2">
                  <span>Total Payment:</span>
                  <span>KES {totalPayment.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-success border-t pt-2">
                <span>Coverage to Add:</span>
                <span>KES {membershipCategory.benefit_amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mpesaReference">M-Pesa Reference (Simulated)</Label>
              <Input
                id="mpesaReference"
                placeholder="Enter M-Pesa transaction code (e.g., NBO123ABC)"
                value={mpesaReference}
                onChange={(e) => setMpesaReference(e.target.value)}
                className="input-field"
              />
            </div>

            <Button type="submit" className="w-full btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Simulate Payment
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberPaymentSimulation;