import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const VerifyOtp = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const phone = new URLSearchParams(location.search).get("phone");

  useEffect(() => {
    if (!phone) {
      navigate("/register");
    }
  }, [phone, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("phone", phone)
        .eq("code", otp)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Invalid or expired code. Please try again.");

      // Mark as verified
      await supabase
        .from("otp_verifications")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", data.id);

      toast({
        title: "Verification Successful",
        description: "Your phone number has been verified. You can now log in.",
      });

      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone) return;
    setResending(true);
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();

      const { error: dbError } = await supabase
        .from("otp_verifications")
        .insert({ phone, code: newCode });

      if (dbError) throw dbError;

      const { data: smsResponse, error: invokeError } = await supabase.functions.invoke('send-sms', {
        body: { type: 'otp', phone, data: { code: newCode } }
      });

      if (invokeError) throw invokeError;

      if (smsResponse && !smsResponse.sms?.success) {
        console.warn("SMS Provider Error:", smsResponse.sms?.message);
        toast({
          title: "SMS Delivery Issue",
          description: `Could not send SMS: ${smsResponse.sms?.message}.`,
          variant: "destructive"
        });
      }

      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your phone.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to resend code. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Verify Your Phone</h1>
          <p className="text-muted-foreground mt-2">
            We've sent a 6-digit code to <span className="font-semibold text-foreground">{phone}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => setOtp(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button type="submit" className="w-full btn-primary h-12" disabled={loading || otp.length !== 6}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Code"}
          </Button>
        </form>

        <div className="pt-4">
          <p className="text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-primary font-semibold hover:underline disabled:opacity-50"
            >
              {resending ? "Resending..." : "Resend Code"}
            </button>
          </p>
        </div>

        <Link to="/register" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to registration
        </Link>
      </div>
    </div>
  );
};

export default VerifyOtp;