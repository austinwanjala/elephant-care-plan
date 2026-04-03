import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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

export default function SuperAgentAddMember() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [marketerInfo, setMarketerInfo] = useState<{ id: string; code: string } | null>(null);

  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [createdMemberId, setCreatedMemberId] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const [step, setStep] = useState(1);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Super agents may have a linked marketer profile
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
        toast({ title: "Still waiting for payment", description: "If the member has paid, it may take a bit longer. You can check later." });
        return;
      }
      try {
        const statusResp = await kopokopoService.checkStatus(kopoResourceId);
        const status = statusResp?.data?.attributes?.status;
        if (status === "Failed" || status === "Error") {
          stopPolling();
          setLoading(false);
          toast({ title: "Payment failed", description: "The STK prompt was cancelled or failed.", variant: "destructive" });
          return;
        }
        const { data: mRow } = await supabase.from("members").select("is_active, membership_category_id").eq("id", memberId).maybeSingle();
        if (mRow?.is_active && mRow?.membership_category_id) {
          stopPolling();
          setLoading(false);
          toast({ title: "Member activated", description: "Payment received and the member is now active." });
          setFormData({ fullName: "", email: "", phone: "", idNumber: "", age: "", password: "" });
          setSelectedCategoryId("");
          setResourceId(null);
          setCreatedMemberId(null);
          navigate("/super-agent");
        }
      } catch {
        // keep polling
      }
    }, 4000);
  };

  const handleRegisterAndSendStk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      toast({ title: "Scheme required", description: "Please select a membership scheme.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const phone = formData.phone.trim();
      if (phone.length < 10) throw new Error("Mobile phone number must be at least 10 digits.");
      
      const idNumber = formData.idNumber.trim();
      if (idNumber.length < 7) throw new Error("ID number must be at least 7 digits.");

      const ageInt = parseInt(formData.age);
      if (isNaN(ageInt) || ageInt <= 0) throw new Error("Please enter a valid age greater than 0.");

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
            ...(marketerInfo ? { marketer_id: marketerInfo.id, marketer_code: marketerInfo.code } : {}),
            membership_category_id: selectedCategory.id,
          },
        },
      });

      if (authError) throw authError;
      const memberId = (authData as any)?.member_id as string | undefined;
      if (!memberId) throw new Error("Member was created but member profile was not returned.");

      setCreatedMemberId(memberId);

      const invoiceNumber = `SA-SCHEME-${Date.now()}`;
      const stk = await kopokopoService.initiateStkPush({
        amount: totalPaymentAmount,
        phone: formData.phone,
        memberId,
        coverageAmount: selectedCategory.benefit_amount,
        paymentType: "Scheme Activation",
        invoiceNumber,
      });

      const rid = stk?.resource_id as string | undefined;
      if (!rid) throw new Error("STK push was initiated but no resource id was returned.");

      setResourceId(rid);
      toast({ title: "STK Prompt Sent", description: "Please ask the member to check their phone and complete the payment." });

      try {
        await supabase.functions.invoke("send-sms", {
          body: { type: "welcome", phone: formData.phone, data: { name: formData.fullName } },
        });
      } catch { /* ignore */ }

      startPollingForActivation(memberId, rid);
    } catch (error: any) {
      stopPolling();
      toast({ title: "Request Failed", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const isAwaitingPayment = !!resourceId && !!createdMemberId;
  const nextStep = () => setStep((prev) => Math.min(prev + 1, 3));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));
  const isStep1Valid = formData.fullName && formData.email && formData.phone && formData.idNumber && formData.age && formData.password.length >= 6;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-indigo-50" onClick={() => navigate("/super-agent")}>
          <ArrowLeft className="h-5 w-5 text-indigo-600" />
        </Button>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Add New Member</h1>
          <p className="text-muted-foreground text-sm">
            Register a new member and activate their scheme on their behalf.
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between px-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2 relative flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 z-10 ${step >= s ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" : "bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/30"}`}>
              {step > s ? "✓" : s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? "text-indigo-600" : "text-muted-foreground"}`}>
              {s === 1 ? "Details" : s === 2 ? "Scheme" : "Payment"}
            </span>
            {s < 3 && (
              <div className={`absolute top-5 left-[50%] w-full h-0.5 transition-all duration-500 -z-0 ${step > s ? "bg-indigo-600" : "bg-muted-foreground/20"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="overflow-hidden border border-border/60 rounded-2xl shadow-xl shadow-indigo-500/5">
        <div className="bg-indigo-50/70 p-4 border-b border-indigo-100 flex items-center justify-between">
          <h2 className="font-serif font-bold text-lg text-indigo-700 flex items-center gap-2">
            {step === 1 && <><UserPlus className="h-5 w-5" /> Personal Information</>}
            {step === 2 && <><Loader2 className="h-5 w-5" /> Select Membership Scheme</>}
            {step === 3 && <><Send className="h-5 w-5" /> Summary & Activation</>}
          </h2>
          <span className="text-xs font-mono text-indigo-600/60 font-bold uppercase tracking-wider">Step {step} of 3</span>
        </div>

        <div className="p-8">
          <form onSubmit={handleRegisterAndSendStk} className="space-y-8">
            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    { label: "Full Name *", key: "fullName", type: "text", placeholder: "e.g. John Doe" },
                    { label: "Email *", key: "email", type: "email", placeholder: "e.g. john@example.com" },
                    { label: "Phone *", key: "phone", type: "text", placeholder: "e.g. +254700000000", hint: "Phone used for M-Pesa STK Prompt", minLength: 10 },
                    { label: "ID Number *", key: "idNumber", type: "text", placeholder: "e.g. 12345678", minLength: 7 },
                    { label: "Age *", key: "age", type: "number", placeholder: "e.g. 30", min: 1 },
                    { label: "Account Password *", key: "password", type: "password", placeholder: "Min. 6 characters", minLength: 6 },
                  ].map(({ label, key, type, placeholder, hint, minLength, min }) => (
                    <div key={key} className="space-y-2">
                      <Label className="text-foreground/80 font-semibold">{label}</Label>
                      <Input
                        type={type}
                        className="h-12 bg-background/50"
                        value={(formData as any)[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        required
                        placeholder={placeholder}
                        disabled={isAwaitingPayment}
                        minLength={minLength}
                        min={min}
                      />
                      {hint && <p className="text-[10px] text-muted-foreground italic">{hint}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={nextStep} disabled={!isStep1Valid}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-lg shadow-indigo-200">
                    Continue to Schemes
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  {categories.map((cat) => {
                    const active = selectedCategoryId === cat.id;
                    const price = Number(cat.payment_amount) + Number(cat.registration_fee) + Number(cat.management_fee);
                    return (
                      <button type="button" key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} disabled={isAwaitingPayment}
                        className={"text-left w-full p-6 border-2 rounded-xl transition-all duration-300 relative group overflow-hidden " + (active ? "border-indigo-500 bg-indigo-50/60 shadow-inner" : "border-border hover:border-indigo-300 bg-card hover:bg-muted/30")}>
                        {active && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">Selected</div>}
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-serif font-bold text-xl block text-foreground">{cat.name}</span>
                            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{cat.level?.toString().split("_").join(" ")} LEVEL</span>
                          </div>
                          <div className="text-right">
                            <span className="text-indigo-600 font-bold text-2xl block">KES {price.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">Total Initial Payment</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-dashed border-muted-foreground/20">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs font-medium">Benefit: KES {Number(cat.benefit_amount).toLocaleString()}</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-xs font-medium">Registration: KES {Number(cat.registration_fee).toLocaleString()}</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-xs font-medium">Management: KES {Number(cat.management_fee).toLocaleString()}</span></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between pt-4 gap-4">
                  <Button type="button" variant="outline" onClick={prevStep} className="h-12 px-8">Back</Button>
                  <Button type="button" onClick={nextStep} disabled={!selectedCategoryId}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-lg shadow-indigo-200 flex-1 md:flex-none">
                    Confirm & Pay
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-6 text-center max-w-md mx-auto">
                <div className="bg-indigo-50/60 border border-indigo-200/60 rounded-2xl p-6 space-y-4">
                  <h3 className="font-serif font-bold text-xl text-indigo-700">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Member:</span><span className="font-bold">{formData.fullName}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Scheme:</span><span className="font-bold">{selectedCategory?.name}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Phone:</span><span className="font-bold">{formData.phone}</span></div>
                  </div>
                  <div className="pt-4 mt-4 border-t border-indigo-200/60 space-y-2">
                    <div className="flex justify-between text-sm"><span>Scheme Contribution:</span><span>KES {Number(selectedCategory?.payment_amount).toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span>Registration Fees:</span><span>KES {(Number(selectedCategory?.registration_fee) + Number(selectedCategory?.management_fee)).toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold text-lg text-indigo-700 pt-2"><span>Total to Pay:</span><span>KES {totalPaymentAmount.toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="space-y-4 pt-4">
                  <Button type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-xl font-bold text-lg shadow-xl shadow-indigo-200 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : isAwaitingPayment ? (
                      <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white rounded-full animate-ping" /><span>Confirming Payment...</span></div>
                    ) : (
                      <div className="flex items-center gap-2"><Send className="h-5 w-5" /><span>Register & Send STK Prompt</span></div>
                    )}
                  </Button>
                  <Button type="button" variant="ghost" onClick={prevStep} className="h-10 text-muted-foreground hover:text-indigo-700">
                    Change Details
                  </Button>
                </div>
                {isAwaitingPayment && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30 animate-pulse">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-widest">Transaction in Progress</p>
                    <p className="text-[10px] text-muted-foreground">Reference ID: <span className="font-mono text-foreground font-bold">{resourceId}</span></p>
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
