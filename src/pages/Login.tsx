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
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" /> Send reset link
          </>
        )}
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

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setLoading(false);
  };

  const resolveRoleFromProfiles = async (userId: string) => {
    // Prefer staff/marketer/member based on existing profile rows.
    const [staffRes, marketerRes, memberRes] = await Promise.all([
      supabase.from("staff").select("role").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("marketers").select("id").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("members").select("id").eq("user_id", userId).limit(1).maybeSingle(),
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
        resetForm();
        return;
      }

      // Check branch suspension status for branch-level users
      if (role !== "super_admin" && role !== "admin" && role !== "auditor" && role !== "finance" && role !== "branch_director") {
        let userBranchId = null;
        
        // Try getting branch_id from staff table
        const { data: staffData } = await supabase.from("staff").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
        if (staffData?.branch_id) {
            userBranchId = staffData.branch_id;
        } else {
            // Try getting branch_id from members table
            const { data: memberData } = await supabase.from("members").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
            if (memberData?.branch_id) userBranchId = memberData.branch_id;
        }

        if (userBranchId) {
            const { data: branchData } = await supabase.from("branches").select("status").eq("id", userBranchId).limit(1).maybeSingle();
            
            // Also check if there are any active (unpaid) high-level warnings issued by the auditor
            // Level 2 = Suspension, Level 3 = Termination
            const { data: activeFines } = await supabase.from("branch_fines")
                .select("warning_level")
                .eq("branch_id", userBranchId)
                .gte("warning_level", 2)
                .eq("status", "unpaid")
                .limit(1)
                .maybeSingle();

            if ((branchData && (branchData.status === 'suspended' || branchData.status === 'terminated')) || activeFines) {
                toast({
                    title: "Branch Suspended",
                    description: "Your branch operations are currently suspended by the auditor. Please contact management.",
                    variant: "destructive",
                });
                await supabase.auth.signOut();
                resetForm();
                return;
            }
        }
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
      } else if (role === "super_agent") {
        navigate("/super-agent");
      } else {
        // Member: ensure the member profile exists before routing (prevents "You don't have member privileges")
        const { error: ensureMemberError } = await supabase.rpc("ensure_member_profile");
        if (ensureMemberError) {
          toast({
            title: "Account setup failed",
            description: ensureMemberError.message,
            variant: "destructive",
          });
          await supabase.auth.signOut();
          resetForm();
          return;
        }

        const { error: ensureDepsError } = await supabase.rpc("ensure_member_dependants_from_metadata");
        if (ensureDepsError) {
          toast({
            title: "Account setup failed",
            description: ensureDepsError.message,
            variant: "destructive",
          });
          await supabase.auth.signOut();
          resetForm();
          return;
        }

        const { data: memberProfile } = await supabase
          .from("members")
          .select("is_active, membership_category_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (memberProfile) {
          // If they have an assigned scheme but are inactive, they have been administratively suspended/deactivated.
          if (!memberProfile.is_active && memberProfile.membership_category_id) {
            toast({
              title: "Account Deactivated",
              description: "Your account has been deactivated. Please contact the administrator.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
            resetForm();
            return;
          }

          if (memberProfile.is_active && memberProfile.membership_category_id) {
            navigate("/dashboard");
          } else {
            // Unassigned scheme users just go to scheme selection
            navigate("/dashboard/scheme-selection");
          }
        } else {
           // Fallback if somehow profile failed
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
    // Reset any retained form state whenever the login page mounts.
    resetForm();

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      // If a session exists when hitting the login page, clear it to ensure 
      // the user starts fresh as requested.
      if (session) {
        console.log("Existing session detected on login page. Clearing session...");
        await supabase.auth.signOut();
        resetForm();
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // If we're on the login page, we only want to redirect if the user
      // has JUST signed in. (Prevents auto-redirect from prior sessions).
      if (event === "SIGNED_IN" && session) {
        setLoading(true);
        if (window.location.pathname === "/login") {
          await checkUserRoleAndNavigate(session.user.id);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        resetForm();
        return;
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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Clear Clinical Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-slate-900/20"
        style={{ 
          backgroundImage: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.6)), url("https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=2000")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      <div className="relative z-10 w-full max-w-lg px-4 sm:px-0">
        <Link to="/" className="inline-flex items-center gap-2 text-white hover:text-white/80 transition-colors mb-6 font-medium bg-black/20 backdrop-blur px-4 py-2 rounded-full shadow-sm text-sm border border-white/20">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        
        <div className="bg-white/90 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] rounded-3xl overflow-hidden border border-white/60">
          
          <div className="w-full h-32 sm:h-48 bg-white relative flex items-center justify-center border-b border-slate-100 p-6 overflow-hidden">
            <img src="/img/elephantlogo.jpg" alt="Elephant Dental Banner" className="w-full h-full object-contain transform scale-110" />
          </div>

          <div className="p-8 sm:p-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">{settings.app_name || "Elephant Dental"}</h1>
              <p className="text-sm text-slate-500 mt-2">Welcome back! Please enter your details.</p>
            </div>

            <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full relative h-12 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium transition-all hover:shadow-sm"
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
              <div className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </div>
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white/90 px-3 text-slate-400 font-medium tracking-wider rounded-full">Or continue with email</span>
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
                  placeholder="Enter your password"
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

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-md shadow-lg shadow-primary/25 transition-all mt-4" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign In to Portal"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 font-medium">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-primary hover:text-primary/80 transition-colors font-bold hover:underline">
              Create an account
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
