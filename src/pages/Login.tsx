import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Check, Eye, EyeOff, Send } from "lucide-react";
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
        description: "We sent a password reset link to your email.",
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
      <div className="py-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium">Password reset email sent.</p>
        <p className="text-xs text-muted-foreground">Open the link in your email to set a new password.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
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
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Send reset link</>}
      </Button>
    </form>
  );
};

import { useSystemSettings } from "@/hooks/useSystemSettings";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSystemSettings();

  const resolveRoleFromProfiles = async (userId: string) => {
    // Prefer staff/marketer/member based on existing profile rows.
    const [staffRes, marketerRes, memberRes] = await Promise.all([
      supabase.from("staff").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("marketers").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("members").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    // Staff tables may not always have role populated for legacy users.
    const staffRole = (staffRes.data as any)?.role as string | undefined;

    if (staffRole && staffRole !== "staff") return staffRole;
    if (marketerRes.data) return "marketer";
    if (memberRes.data) return "member";
    return "member";
  };

  const checkUserRoleAndNavigate = async (userId: string) => {
    try {
      let role: string | null = null;

      // 1) Try read roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!rolesError && rolesData && rolesData.length > 0) {
        const roles = rolesData.map((r) => r.role);
        if (roles.includes("super_admin")) role = "super_admin";
        else if (roles.includes("admin")) role = "admin";
        else role = roles[0];
      }

      // 2) If missing role row, self-heal based on existing profile tables
      if (!role) {
        const inferred = await resolveRoleFromProfiles(userId);
        const { error: insertErr } = await supabase.from("user_roles").insert({
          user_id: userId,
          role: inferred as any,
        } as any);

        if (!insertErr) {
          role = inferred;
        }
      }

      if (!role) {
        toast({
          title: "Setup Incomplete",
          description: "Your account has no portal role assigned. Please contact your administrator.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });

      if (role === "super_admin") {
        navigate("/super-admin");
      } else if (role === "admin") {
        navigate("/admin");
      } else if (role === "finance") {
        navigate("/finance");
      } else if (role === "receptionist") {
        navigate("/reception");
      } else if (role === "doctor") {
        navigate("/doctor");
      } else if (role === "branch_director") {
        navigate("/director");
      } else if (role === "auditor") {
        navigate("/auditor");
      } else if (role === "marketer") {
        navigate("/marketer");
      } else {
        // Member: ensure the member profile exists before routing (prevents "You don't have member privileges")
        await supabase.rpc("ensure_member_profile");
        await supabase.rpc("ensure_member_dependants_from_metadata");

        const { data: memberProfile } = await supabase
          .from("members")
          .select("is_active, membership_category_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (memberProfile && memberProfile.is_active && memberProfile.membership_category_id) {
          navigate("/dashboard");
        } else {
          navigate("/dashboard/scheme-selection");
        }
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Failed to retrieve user details",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setLoading(true);
        await checkUserRoleAndNavigate(session.user.id);
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setLoading(true);
        if (window.location.pathname === "/login") {
          await checkUserRoleAndNavigate(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await checkUserRoleAndNavigate(data.user.id);
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-serif font-bold text-foreground">{settings.app_name || "Elephant Dental"}</span>
          </div>

          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full relative"
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: `${window.location.origin}/login`,
                      queryParams: {
                        access_type: "offline",
                        prompt: "consent",
                      },
                    },
                  });

                  if (error) throw error;
                } catch (error: any) {
                  toast({
                    title: "Google Login Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4"
                  aria-hidden="true"
                  focusable="false"
                  data-prefix="fab"
                  data-icon="google"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 488 512"
                >
                  <path
                    fill="currentColor"
                    d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                  ></path>
                </svg>
                Continue with Google
              </div>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </div>

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

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block relative flex-1 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-serif font-bold text-foreground">Welcome back</h2>
            <p className="text-lg text-muted-foreground">
              Sign in to access your Elephant Dental portal and manage your membership, appointments, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;