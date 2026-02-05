import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Mail, Phone, RefreshCw } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

const VerifyOtp = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const phone = searchParams.get("phone") || "";
  const email = searchParams.get("email") || "";

  useEffect(() => {
    if (!phone && !email) {
      toast({
        title: "Invalid Request",
        description: "Please start the registration process again.",
        variant: "destructive",
      });
      navigate("/register");
    }
  }, [phone, email, navigate, toast]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verify OTP from database
      const { data: otpRecord, error: otpError } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("phone", phone)
        .eq("code", otp)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpError) throw otpError;

      if (!otpRecord) {
        toast({
          title: "Invalid Code",
          description: "The code is incorrect or has expired. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Mark OTP as verified
      await supabase
        .from("otp_verifications")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", otpRecord.id);

      toast({
        title: "Verification Successful!",
        description: "Your account has been verified. Please log in.",
      });

      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "An error occurred during verification.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      // Generate new OTP
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Insert new OTP record
      const { error: otpError } = await supabase
        .from("otp_verifications")
        .insert({
          phone,
          code: newOtpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (otpError) throw otpError;

      // Send OTP via SMS and Email
      await supabase.functions.invoke("send-sms", {
        body: {
          type: "otp",
          phone,
          email,
          data: { code: newOtpCode },
        },
      });

      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your phone and email.",
      });

      setCountdown(60);
    } catch (error: any) {
      toast({
        title: "Resend Failed",
        description: error.message || "Failed to resend verification code.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Link to="/register" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to registration
          </Link>

          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl">🐘</span>
            </div>
            <span className="text-xl font-serif font-bold text-foreground">Elephant Dental</span>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Verify Your Account</h1>
          <p className="text-muted-foreground mb-8">
            We've sent a 6-digit verification code to your phone and email.
          </p>

          <div className="card-elevated p-6 space-y-6">
            {/* Contact Info Display */}
            <div className="space-y-3">
              {phone && (
                <div className="flex items-center gap-3 text-sm p-3 bg-muted rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">SMS sent to:</span>
                  <span className="font-medium">{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-3 text-sm p-3 bg-muted rounded-lg">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Email sent to:</span>
                  <span className="font-medium">{email}</span>
                </div>
              )}
            </div>

            {/* OTP Input */}
            <div className="flex flex-col items-center space-y-4">
              <label className="text-sm font-medium text-foreground">Enter verification code</label>
              <InputOTP
                value={otp}
                onChange={setOtp}
                maxLength={6}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerify}
              className="w-full btn-primary"
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Account"
              )}
            </Button>

            {/* Resend Section */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Didn't receive the code?
              </p>
              <Button
                variant="outline"
                onClick={handleResendOtp}
                disabled={resending || countdown > 0}
                className="gap-2"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : countdown > 0 ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Resend in {countdown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Resend Code
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already verified?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 hero-gradient items-center justify-center p-12">
        <div className="max-w-md text-center text-primary-foreground">
          <div className="w-24 h-24 rounded-full bg-primary-foreground/10 flex items-center justify-center mx-auto mb-8">
            <span className="text-5xl">🔐</span>
          </div>
          <h2 className="text-3xl font-serif font-bold mb-4">Secure Verification</h2>
          <p className="text-primary-foreground/80 text-lg">
            We use two-factor authentication to ensure your account is protected. Check both your phone and email for the verification code.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
