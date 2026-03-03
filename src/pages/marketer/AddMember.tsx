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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/marketer">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Register Member & Activate Scheme</h1>
          <p className="text-muted-foreground">
            Create a member, select a scheme, and send an M-Pesa STK prompt. The member becomes active after payment.
          </p>
        </div>
      </div>

      <div className="card-elevated p-6">
        <form onSubmit={handleRegisterAndSendStk} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="e.g. John Doe"
                disabled={isAwaitingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="e.g. john@example.com"
                disabled={isAwaitingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="e.g. +254700000000"
                disabled={isAwaitingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label>ID Number *</Label>
              <Input
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                required
                placeholder="e.g. 12345678"
                disabled={isAwaitingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label>Age *</Label>
              <Input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                required
                placeholder="e.g. 30"
                disabled={isAwaitingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label>Set Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                placeholder="Enter password"
                disabled={isAwaitingPayment}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Membership Scheme *</Label>
            <div className="grid gap-3">
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
                      "text-left w-full p-4 border rounded-lg transition-all " +
                      (active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/50")
                    }
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">
                        {cat.name} ({cat.level?.toString().split("_").join(" ")})
                      </span>
                      <span className="text-primary font-bold">KES {price.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Benefit: KES {Number(cat.benefit_amount).toLocaleString()} | Fees: KES{" "}
                      {(Number(cat.registration_fee) + Number(cat.management_fee)).toLocaleString()}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCategory && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span>Payment (scheme):</span>
                <span>KES {Number(selectedCategory.payment_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Registration fee:</span>
                <span>KES {Number(selectedCategory.registration_fee).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Management fee:</span>
                <span>KES {Number(selectedCategory.management_fee).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                <span>Total to pay:</span>
                <span>KES {totalPaymentAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            disabled={loading || !marketerInfo}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isAwaitingPayment ? (
              <Send className="mr-2 h-4 w-4" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isAwaitingPayment ? "Waiting for payment..." : "Register & Send STK Prompt"}
          </Button>

          {isAwaitingPayment && (
            <div className="text-xs text-muted-foreground">
              Payment request sent. Reference ID: <span className="font-mono">{resourceId}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
