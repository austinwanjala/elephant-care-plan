import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Trash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Dependant {
  fullName: string;
  dob: string;
  idNumber: string; // Birth Cert or Student ID
  relationship: string;
}

interface Marketer {
  id: string;
  full_name: string;
  code: string;
}

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    idNumber: "",
    age: "",
    email: "",
    password: "",
  });
  const [referralSource, setReferralSource] = useState("");
  const [marketerCode, setMarketerCode] = useState("");
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [consentToS, setConsentToS] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      setReferralSource("Marketer");
      setMarketerCode(refCode);
    }
    fetchMarketers();
  }, [searchParams]);

  const fetchMarketers = async () => {
    const { data, error } = await supabase
      .from("marketers")
      .select("id, full_name, code")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching marketers:", error);
    } else {
      setMarketers(data || []);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addDependant = () => {
    if (dependants.length >= 5) {
      toast({ title: "Maximum 5 dependants allowed", variant: "destructive" });
      return;
    }
    setDependants([...dependants, { fullName: "", dob: "", idNumber: "", relationship: "" }]);
  };

  const updateDependant = (index: number, field: keyof Dependant, value: string) => {
    const newDependants = [...dependants];
    newDependants[index] = { ...newDependants[index], [field]: value };
    setDependants(newDependants);
  };

  const removeDependant = (index: number) => {
    const newDependants = dependants.filter((_, i) => i !== index);
    setDependants(newDependants);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consentToS || !consentPrivacy) {
      toast({ title: "Please accept the Terms of Service and Privacy Policy", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // 1. Create auth user with all metadata for atomic setup
      const userMetadata = {
        role: 'member',
        full_name: formData.fullName,
        phone: formData.phone,
        id_number: formData.idNumber,
        age: formData.age,
        marketer_code: referralSource === "Marketer" ? marketerCode : null,
        referral_source: referralSource
      };

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: userMetadata
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // 2. Fetch the created member record to add dependants
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (memberError) throw memberError;

      // 3. Add Dependants if any
      if (dependants.length > 0 && memberData) {
        const dependantsToInsert = dependants.map(d => ({
          member_id: memberData.id,
          full_name: d.fullName,
          dob: d.dob,
          identification_number: d.idNumber,
          relationship: d.relationship || 'Dependant'
        }));

        const { error: depError } = await supabase.from("dependants").insert(dependantsToInsert);
        if (depError) console.error("Error adding dependants:", depError);
      }

      // 4. Generate and Send OTP for verification
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      const { error: otpError } = await supabase
        .from("otp_verifications")
        .insert({
          phone: formData.phone,
          code: otpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (otpError) throw otpError;

      // Send OTP via SMS and Email
      try {
        await supabase.functions.invoke('send-sms', {
          body: {
            type: 'otp',
            phone: formData.phone,
            email: formData.email,
            data: { code: otpCode }
          }
        });
      } catch (smsErr: any) {
        console.error("Failed to send OTP notification:", smsErr);
      }

      toast({
        title: "Verification Code Sent",
        description: "Please check your phone and email for the 6-digit code.",
      });

      navigate(`/verify-otp?phone=${encodeURIComponent(formData.phone)}&email=${encodeURIComponent(formData.email)}`);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
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

        <div className="card-elevated p-8">
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Member Registration</h1>
          <p className="text-muted-foreground mb-8">
            Create your account. You will select your membership scheme after logging in.
          </p>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="0700000000"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  placeholder="12345678"
                  value={formData.idNumber}
                  onChange={(e) => handleChange("idNumber", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="30"
                  value={formData.age}
                  onChange={(e) => handleChange("age", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="referralSource">How did you hear about us?</Label>
                <Select value={referralSource} onValueChange={setReferralSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Google">Google Search</SelectItem>
                    <SelectItem value="Friend">Friend / Family</SelectItem>
                    <SelectItem value="Marketer">Sales Agent / Marketer</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {referralSource === "Marketer" && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="marketerCode">Select Marketer</Label>
                  <Select value={marketerCode} onValueChange={setMarketerCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Marketer" />
                    </SelectTrigger>
                    <SelectContent>
                      {marketers.length > 0 ? (
                        marketers.map((m) => (
                          <SelectItem key={m.id} value={m.code}>
                            {m.full_name} ({m.code})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No active marketers found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Dependants (Max 5)</h3>
                <Button type="button" variant="outline" size="sm" onClick={addDependant}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dependant
                </Button>
              </div>

              {dependants.map((dep, index) => (
                <div key={index} className="bg-secondary/20 p-4 rounded-lg space-y-4 relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-destructive hover:text-destructive/90"
                    onClick={() => removeDependant(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dependant Name</Label>
                      <Input
                        value={dep.fullName}
                        onChange={(e) => updateDependant(index, "fullName", e.target.value)}
                        placeholder="Name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={dep.dob}
                        onChange={(e) => updateDependant(index, "dob", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Birth Cert / Student ID</Label>
                      <Input
                        value={dep.idNumber}
                        onChange={(e) => updateDependant(index, "idNumber", e.target.value)}
                        placeholder="ID Number"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Input
                        value={dep.relationship}
                        onChange={(e) => updateDependant(index, "relationship", e.target.value)}
                        placeholder="e.g. Child, Spouse"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox id="consentToS" checked={consentToS} onCheckedChange={(checked) => setConsentToS(checked as boolean)} />
                <Label htmlFor="consentToS" className="text-sm">
                  I agree to the <Link to="/terms-of-service" className="text-primary hover:underline" target="_blank">Terms of Service</Link>.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="consentPrivacy" checked={consentPrivacy} onCheckedChange={(checked) => setConsentPrivacy(checked as boolean)} />
                <Label htmlFor="consentPrivacy" className="text-sm">
                  I agree to the <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">Privacy Policy</Link>.
                </Label>
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Register Member"
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;