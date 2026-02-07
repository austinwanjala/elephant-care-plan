import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Check your email",
        description: "We have sent a password reset link to your email address.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 text-green-800 p-4 rounded-lg text-center">
        <p className="font-semibold mb-2">Check your inbox!</p>
        <p className="text-xs">Link sent to <span className="font-bold">{email}</span>.</p>
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setSuccess(false)}>
          Try another email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email address</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full btn-primary" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Send Reset Link</>}
      </Button>
    </form>
  );
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check user role and redirect accordingly
      let role = null;
      let attempts = 0;
      const maxAttempts = 5;
      const delayMs = 500; // 0.5 seconds

      while (attempts < maxAttempts && role === null) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleData?.role) {
          role = roleData.role;
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (!role) {
        toast({
          title: "Setup Incomplete",
          description: "Your account is authenticated but has no portal role assigned after multiple attempts. Please contact your administrator.",
          variant: "destructive",
        });
        // logout to clear session
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "receptionist") {
        navigate("/reception");
      } else if (role === "doctor") {
        navigate("/doctor");
      } else if (role === "branch_director") {
        navigate("/director");
      } else if (role === "marketer") {
        navigate("/marketer");
      } else if (role === "member") {
        // For members, check if they have selected a scheme and made initial payment
        const { data: memberProfile, error: memberProfileError } = await supabase
          .from("members")
          .select("is_active")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (memberProfileError) throw memberProfileError;

        if (memberProfile && memberProfile.is_active) {
          navigate("/dashboard");
        } else {
          // If not active, redirect to scheme selection/payment page
          navigate("/dashboard/scheme-selection");
        }
      } else {
        navigate("/"); // Fallback to home if role is unknown
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl">🐘</span>
            </div>
            <span className="text-xl font-serif font-bold text-foreground">Elephant Dental</span>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Sign in to access your insurance portal</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" className="text-xs text-primary hover:underline bg-transparent border-0 p-0 h-auto">
                      Forgot Password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                    </DialogHeader>
                    <ForgotPasswordForm />
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <Button type="submit" className="w-full btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Register now
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 hero-gradient items-center justify-center p-12">
        <div className="max-w-md text-center text-primary-foreground">
          <div className="w-24 h-24 rounded-full bg-primary-foreground/10 flex items-center justify-center mx-auto mb-8">
            <span className="text-5xl">🐘</span>
          </div>
          <h2 className="text-3xl font-serif font-bold mb-4">Your Dental Health Partner</h2>
          <p className="text-primary-foreground/80 text-lg">
            Access your coverage balance, view payment history, and manage your dental insurance all in one place.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;