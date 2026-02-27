import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, UserPlus, Plus, Trash, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Dependant {
  fullName: string;
  relationship: string;
  dob: string;
  idNumber: string;
  gender: string;
}

import { useSystemSettings } from "@/hooks/useSystemSettings";

const calculateAge = (dobString: string): number => {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const Register = () => {
  const { settings } = useSystemSettings();
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    idNumber: "",
    dob: "",
    email: "",
    password: "",
  });

  const [referralSource, setReferralSource] = useState<string>("");
  const [selectedMarketer, setSelectedMarketer] = useState<{ id: string; full_name: string; code: string } | null>(null);
  const [marketers, setMarketers] = useState<any[]>([]);
  const [isMarketerModalOpen, setIsMarketerModalOpen] = useState(false);
  const [isDependantModalOpen, setIsDependantModalOpen] = useState(false);
  const [marketerSearch, setMarketerSearch] = useState("");
  const [loadingMarketers, setLoadingMarketers] = useState(false);

  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [newDep, setNewDep] = useState<Dependant>({
    fullName: "",
    relationship: "",
    dob: "",
    idNumber: "",
    gender: "male",
  });

  const [consents, setConsents] = useState({
    processing: false,
    sharing: false,
    signature: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem("registration_form_data");
    const savedReferral = localStorage.getItem("registration_referral_source");
    const savedMarketer = localStorage.getItem("registration_selected_marketer");
    const savedDependants = localStorage.getItem("registration_dependants");

    if (savedData) setFormData(JSON.parse(savedData));
    if (savedReferral) setReferralSource(savedReferral);
    if (savedMarketer) setSelectedMarketer(JSON.parse(savedMarketer));
    if (savedDependants) setDependants(JSON.parse(savedDependants));
  }, []);

  useEffect(() => {
    localStorage.setItem("registration_form_data", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem("registration_referral_source", referralSource);
  }, [referralSource]);

  useEffect(() => {
    if (selectedMarketer) {
      localStorage.setItem("registration_selected_marketer", JSON.stringify(selectedMarketer));
    } else {
      localStorage.removeItem("registration_selected_marketer");
    }
  }, [selectedMarketer]);

  useEffect(() => {
    localStorage.setItem("registration_dependants", JSON.stringify(dependants));
  }, [dependants]);

  const clearPersistedData = () => {
    localStorage.removeItem("registration_form_data");
    localStorage.removeItem("registration_referral_source");
    localStorage.removeItem("registration_selected_marketer");
    localStorage.removeItem("registration_dependants");
  };

  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchMarketers = async () => {
    setLoadingMarketers(true);
    try {
      const { data, error } = await supabase
        .from("marketers")
        .select("id, full_name, code")
        .eq("is_active", true);

      if (error) throw error;
      setMarketers(data || []);
    } catch (err: any) {
      console.error("Error fetching marketers:", err);
    } finally {
      setLoadingMarketers(false);
    }
  };

  const handleReferralChange = (value: string) => {
    setReferralSource(value);
    if (value === "marketer") {
      fetchMarketers();
      setIsMarketerModalOpen(true);
    } else {
      setSelectedMarketer(null);
    }
  };

  const addDependant = () => {
    if (!newDep.fullName || !newDep.relationship || !newDep.dob || !newDep.gender) {
      toast({ title: "Missing Info", description: "Please fill in all dependant details.", variant: "destructive" });
      return;
    }
    if (dependants.length >= 5) {
      toast({ title: "Limit Reached", description: "Maximum 5 dependants allowed.", variant: "destructive" });
      return;
    }
    setDependants([...dependants, newDep]);
    setNewDep({ fullName: "", relationship: "", dob: "", idNumber: "", gender: "male" });
    setIsDependantModalOpen(false);
  };

  const removeDependant = (index: number) => {
    setDependants(dependants.filter((_, i) => i !== index));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consents.processing || !consents.sharing || !consents.signature) {
      toast({
        title: "Consents required",
        description: "Please accept all terms and conditions to proceed.",
        variant: "destructive",
      });
      return;
    }

    if (referralSource === "marketer" && !selectedMarketer) {
      toast({
        title: "Marketer required",
        description: "Please select a marketer from the list.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const signUpRes = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: "member",
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            dob: formData.dob,
            marketer_id: selectedMarketer?.id || null,
            marketer_code: selectedMarketer?.code || null,
            dependants,
          },
        },
      });

      if (signUpRes.error) throw signUpRes.error;

      // Always route to login after registration (per requirement)
      // and clear any session that might have been created.
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      toast({
        title: "Registration Successful",
        description: "Your account has been created. Please log in with your email and password.",
      });

      clearPersistedData();
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMarketers = marketers.filter(
    (m) => m.full_name.toLowerCase().includes(marketerSearch.toLowerCase()) || m.code.toLowerCase().includes(marketerSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-white to-orange-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="card-elevated p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-serif font-bold text-foreground">{settings.app_name || "Elephant Dental"}</span>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Member Registration</h1>
          <p className="text-muted-foreground mb-8">Join the Elephant Care Plan today.</p>

          <div className="space-y-4 mb-8">
            <Button
              type="button"
              variant="outline"
              className="w-full relative py-6"
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
                    title: "Google Registration Failed",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              <div className="flex items-center justify-center gap-2 text-base">
                <svg
                  className="h-5 w-5"
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
                Sign up with Google
              </div>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or register with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Personal Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" placeholder="John Doe" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="0712 345 678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNumber">National ID / Passport</Label>
                  <Input id="idNumber" placeholder="12345678" value={formData.idNumber} onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="dob">Date of Birth</Label>
                    {formData.dob && (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Age: {calculateAge(formData.dob)} yrs</span>
                    )}
                  </div>
                  <Input id="dob" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} required max={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Referral Information</h3>
              <div className="space-y-2">
                <Label>How did you hear about us?</Label>
                <Select value={referralSource} onValueChange={handleReferralChange}>
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="friend">Friend or Family</SelectItem>
                    <SelectItem value="marketer">Marketer / Agent</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {selectedMarketer && (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <UserPlus className="h-4 w-4" /> Referred by: <strong>{selectedMarketer.full_name} ({selectedMarketer.code})</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold">Add Dependants (Optional)</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDependantModalOpen(true)} disabled={dependants.length >= 5}>
                  <Plus className="h-4 w-4 mr-1" /> Add Dependant
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">You can add up to 5 family members to share your coverage.</p>

              {dependants.length > 0 && (
                <div className="grid gap-2 mt-4">
                  {dependants.map((dep, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{dep.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {dep.relationship} • {calculateAge(dep.dob)} yrs • {dep.gender} • ID: {dep.idNumber || "N/A"}
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeDependant(idx)}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-6 border-t border-border">
              <div className="flex items-start space-x-3">
                <Checkbox id="processing" checked={consents.processing} onCheckedChange={(checked) => setConsents({ ...consents, processing: !!checked })} />
                <Label htmlFor="processing" className="text-sm leading-none">
                  I consent to the processing of my personal data as per the <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox id="sharing" checked={consents.sharing} onCheckedChange={(checked) => setConsents({ ...consents, sharing: !!checked })} />
                <Label htmlFor="sharing" className="text-sm leading-none">
                  I authorize data sharing with affiliated branches as per the <Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link>.
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox id="signature" checked={consents.signature} onCheckedChange={(checked) => setConsents({ ...consents, signature: !!checked })} />
                <Label htmlFor="signature" className="text-sm leading-none">
                  I agree to the <Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link>.
                </Label>
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary py-6 text-lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Complete Registration"}
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={isMarketerModalOpen} onOpenChange={setIsMarketerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Marketer</DialogTitle>
            <DialogDescription>Choose the agent who referred you to Elephant Dental.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input placeholder="Search by name or code" value={marketerSearch} onChange={(e) => setMarketerSearch(e.target.value)} />

            <div className="max-h-72 overflow-y-auto border rounded-md">
              {loadingMarketers ? (
                <div className="p-4 text-sm text-muted-foreground">Loading...</div>
              ) : filteredMarketers.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No marketers found.</div>
              ) : (
                filteredMarketers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0"
                    onClick={() => {
                      setSelectedMarketer(m);
                      setIsMarketerModalOpen(false);
                    }}
                  >
                    <div className="font-medium">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">Code: {m.code}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReferralSource("");
                setSelectedMarketer(null);
                setIsMarketerModalOpen(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDependantModalOpen} onOpenChange={setIsDependantModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Dependant</DialogTitle>
            <DialogDescription>Enter dependant details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={newDep.fullName} onChange={(e) => setNewDep({ ...newDep, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Input value={newDep.relationship} onChange={(e) => setNewDep({ ...newDep, relationship: e.target.value })} placeholder="e.g. Spouse, Child" />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={newDep.dob} onChange={(e) => setNewDep({ ...newDep, dob: e.target.value })} max={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-2">
              <Label>ID Number (Optional)</Label>
              <Input value={newDep.idNumber} onChange={(e) => setNewDep({ ...newDep, idNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={newDep.gender} onValueChange={(v) => setNewDep({ ...newDep, gender: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDependantModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={addDependant} className="btn-primary">
              Add Dependant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Register;