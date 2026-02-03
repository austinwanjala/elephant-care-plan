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
  const [mpesaReference, setMpesaReference] = useState("");
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
      .select("id, full_name, coverage_balance, total_contributions, benefit_limit, membership_category_id, is_active, member_number")
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

    if (memberData.is_active) {
      navigate("/dashboard");
      return;
    }

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

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || !selectedCategory) {
      toast({ title: "Selection Required", description: "Please select a membership scheme.", variant: "destructive" });
      return;
    }
    if (!mpesaReference) {
      toast({ title: "M-Pesa Reference Required", description: "Please enter a simulated M-Pesa reference.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const principalAmount = selectedCategory.payment_amount;
      // Use benefit_amount from category as the source of truth for coverage
      const benefitToAdd = selectedCategory.benefit_amount; 
      const totalPayment = principalAmount + selectedCategory.registration_fee + selectedCategory.management_fee;

      const qrCodeValue = `MEMBER-${member.member_number}`;

      // 1. Update member's coverage, contributions, activate, and set category
      const { error: updateError } = await supabase
        .from("members")
        .update({
          coverage_balance: (member.coverage_balance || 0) + benefitToAdd,
          total_contributions: (member.total_contributions || 0) + principalAmount,
          is_active: true,
          qr_code_data: qrCodeValue,
          membership_category_id: selectedCategory.id,
          benefit_limit: (member.benefit_limit || 0) + benefitToAdd,
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

      navigate("/dashboard");
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
      <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <Card className="card-elevated p-8">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-serif font-bold text-foreground mb-2">
            Select Your Membership Scheme
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a scheme level and make your first payment to activate your dental coverage.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <form onSubmit={handleSimulatePayment} className="space-y-6">
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
                      <span>Total Payment:</span>
                      <span>KES {totalPayment.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-success border-t pt-2">
                    <span>Coverage to Add:</span>
                    <span>KES {selectedCategory.benefit_amount.toLocaleString()}</span>
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
                    required
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
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberSchemeSelection;