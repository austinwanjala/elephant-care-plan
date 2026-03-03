import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { kopokopoService } from "@/services/kopokopo";

interface MembershipCategory {
  id: string;
  name: string;
  payment_amount: number;
  benefit_amount: number;
  registration_fee: number;
  management_fee: number;
  level: string;
}

export default function MarketerAddMember() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [marketerInfo, setMarketerInfo] = useState<{ id: string; code: string } | null>(null);

  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const [resourceId, setResourceId] = useState<string | null>(null);
  const [createdMemberId, setCreatedMemberId] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    age: "",
    password: "",
  });

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const totalPaymentAmount = useMemo(() => {
    if (!selectedCategory) return 0;
    return (
      Number(selectedCategory.payment_amount) +
      Number(selectedCategory.registration_fee) +
      Number(selectedCategory.management_fee)
    );
  }, [selectedCategory]);

  useEffect(() => {
    fetchMarketerInfo();
    fetchCategories();

    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  const fetchMarketerInfo = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: mData } = await supabase
      .from("marketers")
      .select("id, code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (mData) setMarketerInfo(mData);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("membership_categories")
      .select("*")
      .eq("is_active", true)
      .order("level", { ascending: true });

    if (error) {
      toast({ title: "Failed to load schemes", description: error.message, variant: "destructive" });
      return;
    }

    setCategories((data as any) || []);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startPollingForActivation = (memberId: string, kopoResourceId: string) => {
    stopPolling();

    let attempts = 0;
    pollTimerRef.current = window.setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        stopPolling();
        setLoading(false);
        toast({
          title: "Still waiting for payment",
          description: "If the member has paid, it may take a bit longer to confirm. You can check later in your referrals.",
        });
        return;
      }

      try {
        // 1) Ask KopoKopo for latest status (this will also auto-update DB in the edge function when Success)
        const statusResp = await kopokopoService.checkStatus(kopoResourceId);
        const status = statusResp?.data?.attributes?.status;

        if (status === "Failed" || status === "Error") {
          stopPolling();
          setLoading(false);
          toast({
            title: "Payment failed",
            description: "The STK prompt was cancelled or failed. You can re-initiate payment from the member record.",
            variant: "destructive",
          });
          return;
        }

        // 2) Confirm member activation (marketer can view referred members)
        const { data: mRow } = await supabase
          .from("members")
          .select("is_active, membership_category_id")
          .eq("id", memberId)
          .maybeSingle();

        if (mRow?.is_active && mRow?.membership_category_id) {
          stopPolling();
          setLoading(false);
          toast({
            title: "Member activated",
            description: "Payment received and the member is now active.",
          });
          setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "" });
          setSelectedCategoryId("");
          setResourceId(null);
          setCreatedMemberId(null);
          navigate("/marketer/referrals");
        }
      } catch {
        // keep polling (temporary network issues)
      }
    }, 4000);
  };

  const handleRegisterAndSendStk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!marketerInfo) {
      toast({ title: "Error", description: "Marketer profile not found.", variant: "destructive" });
      return;
    }

    if (!selectedCategory) {
      toast({ title: "Scheme required", description: "Please select a membership scheme.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const ageInt = parseInt(formData.age);
      if (isNaN(ageInt)) throw new Error("Please enter a valid age.");

      const { data: authData, error: authError } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          metadata: {
            role: "member",
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            age: ageInt,
            marketer_id: marketerInfo.id,
            marketer_code: marketerInfo.code,
            membership_category_id: selectedCategory.id,
          },
        },
      });

      if (authError) throw authError;

      const memberId = (authData as any)?.member_id as string | undefined;
      if (!memberId) {
        throw new Error("Member was created but member profile was not returned. Please refresh and check your referrals.");
      }

      setCreatedMemberId(memberId);

      // Initiate STK Push
      const invoiceNumber = `SCHEME-${Date.now()}`;
      const stk = await kopokopoService.initiateStkPush({
        amount: totalPaymentAmount,
        phone: formData.phone,
        memberId,
        coverageAmount: selectedCategory.benefit_amount,
        paymentType: "Scheme Activation",
        invoiceNumber,
      });

      const rid = stk?.resource_id as string | undefined;
      if (!rid) {
        throw new Error("STK push was initiated but no resource id was returned.");
      }

      setResourceId(rid);

      toast({
        title: "STK Prompt Sent",
        description: "Please ask the member to check their phone and complete the payment.",
      });

      // Optional welcome SMS
      try {
        await supabase.functions.invoke("send-sms", {
          body: {
            type: "welcome",
            phone: formData.phone,
            data: { name: formData.fullName },
          },
        });
      } catch {
        // ignore
      }

      startPollingForActivation(memberId, rid);
    } catch (error: any) {
      stopPolling();
      toast({ title: "Request Failed", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const isAwaitingPayment = !!resourceId && !!createdMemberId;

  const [step, setStep] = useState(1);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const isStep1Valid = formData.fullName && formData.email && formData.phone && formData.idNumber && formData.age && formData.password.length >= 6;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-2 animate-fade-in">
        <Link to="/marketer">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Add New Member</h1>
          <p className="text-muted-foreground text-sm">
            Complete the steps below to register a new member and activate their scheme.
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between px-2 mb-8 animate-fade-in">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2 relative flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 z-10 ${step >= s ? "bg-primary text-white shadow-lg scale-110" : "bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/30"
                }`}
            >
              {step > s ? "✓" : s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? "text-primary" : "text-muted-foreground"}`}>
              {s === 1 ? "Details" : s === 2 ? "Scheme" : "Payment"}
            </span>
            {s < 3 && (
              <div
                className={`absolute top-5 left-[50%] w-full h-0.5 transition-all duration-500 -z-0 ${step > s ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card-elevated overflow-hidden border-0 shadow-2xl animate-slide-up">
        <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between">
          <h2 className="font-serif font-bold text-lg text-primary flex items-center gap-2">
            {step === 1 && <><UserPlus className="h-5 w-5" /> Personal Information</>}
            {step === 2 && <><Loader2 className="h-5 w-5" /> Select Membership Scheme</>}
            {step === 3 && <><Send className="h-5 w-5" /> Summary & Activation</>}
          </h2>
          <span className="text-xs font-mono text-primary/60 font-bold uppercase tracking-wider">Step {step} of 3</span>
        </div>

        <div className="p-8">
          <form onSubmit={handleRegisterAndSendStk} className="space-y-8">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-semibold">Full Name *</Label>
                    <Input
                      className="input-field h-12 bg-background/50"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                      placeholder="e.g. John Doe"
                      disabled={isAwaitingPayment}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-semibold">Email *</Label>
                    <Input
                      type="email"
                      className="input-field h-12 bg-background/50"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="e.g. john@example.com"
                      disabled={isAwaitingPayment}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-semibold">Phone *</Label>
                    <Input
                      className="input-field h-12 bg-background/50"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      placeholder="e.g. +254700000000"
                      disabled={isAwaitingPayment}
                    />
                    <p className="text-[10px] text-muted-foreground italic">Phone used for M-Pesa STK Prompt</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-semibold">ID Number *</Label>
                    <Input
                      className="input-field h-12 bg-background/50"
                      value={formData.idNumber}
                      onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                      required
                      placeholder="e.g. 12345678"
                      disabled={isAwaitingPayment}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-semibold">Age *</Label>
                    <Input
                      type="number"
                      className="input-field h-12 bg-background/50"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      required
                      placeholder="e.g. 30"
                      disabled={isAwaitingPayment}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-semibold">Account Password *</Label>
                    <Input
                      type="password"
                      className="input-field h-12 bg-background/50"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Enter secure password"
                      disabled={isAwaitingPayment}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={!isStep1Valid}
                    className="bg-primary hover:bg-primary/90 text-white px-8 h-12 rounded-lg font-bold shadow-lg shadow-primary/20"
                  >
                    Continue to Schemes
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Scheme Selection */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid gap-4">
                  {categories.map((cat) => {
                    const active = selectedCategoryId === cat.id;
                    const price =
                      Number(cat.payment_amount) + Number(cat.registration_fee) + Number(cat.management_fee);

                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        disabled={isAwaitingPayment}
                        className={
                          "text-left w-full p-6 border-2 rounded-xl transition-all duration-300 relative group overflow-hidden " +
                          (active
                            ? "border-primary bg-primary/5 shadow-inner"
                            : "border-border hover:border-primary/50 bg-card hover:bg-muted/30")
                        }
                      >
                        {active && <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">Selected</div>}
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-serif font-bold text-xl block text-foreground">
                              {cat.name}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                              {cat.level?.toString().split("_").join(" ")} LEVEL
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-primary font-bold text-2xl block">KES {price.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">Total Initial Payment</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-dashed border-muted-foreground/20">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-medium">Benefit: KES {Number(cat.benefit_amount).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-xs font-medium">Registration: KES {Number(cat.registration_fee).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-xs font-medium">Management: KES {Number(cat.management_fee).toLocaleString()}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between pt-4 gap-4">
                  <Button type="button" variant="outline" onClick={prevStep} className="h-12 px-8">Back</Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={!selectedCategoryId}
                    className="bg-primary hover:bg-primary/90 text-white px-8 h-12 rounded-lg font-bold shadow-lg shadow-primary/20 flex-1 md:flex-none"
                  >
                    Confirm & Pay
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Payment */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in text-center max-w-md mx-auto">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif font-bold text-xl text-primary">Order Summary</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Member:</span>
                      <span className="font-bold">{formData.fullName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Scheme:</span>
                      <span className="font-bold">{selectedCategory?.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-bold">{formData.phone}</span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-primary/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Scheme Contribution:</span>
                      <span>KES {Number(selectedCategory?.payment_amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Registration Fees:</span>
                      <span>KES {(Number(selectedCategory?.registration_fee) + Number(selectedCategory?.management_fee)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg text-primary pt-2">
                      <span>Total to Pay:</span>
                      <span>KES {totalPaymentAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white h-14 rounded-xl font-bold text-lg shadow-xl shadow-purple-200 transition-all duration-300 scale-100 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={loading || !marketerInfo}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : isAwaitingPayment ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                        <span>Confirming Payment...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        <span>Register & Send STK Prompt</span>
                      </div>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2">
                    <Button type="button" variant="ghost" onClick={prevStep} className="h-10 text-muted-foreground hover:text-primary">
                      Change Details
                    </Button>
                  </div>
                </div>

                {isAwaitingPayment && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30 animate-pulse">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-widest">Transaction in Progress</p>
                    <p className="text-[10px] text-muted-foreground">
                      Reference ID: <span className="font-mono text-foreground font-bold">{resourceId}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
