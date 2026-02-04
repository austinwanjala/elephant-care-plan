import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, UserPlus, Search, Plus, Trash, Users, CreditCard } from "lucide-react";
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
  });

  const [consents, setConsents] = useState({
    processing: false,
    sharing: false,
    signature: false,
  });
  const [loading, setLoading] = useState(false);

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
    if (!newDep.fullName || !newDep.relationship || !newDep.dob) {
      toast({ title: "Missing Info", description: "Please fill in all dependant details.", variant: "destructive" });
      return;
    }
    if (dependants.length >= 5) {
      toast({ title: "Limit Reached", description: "Maximum 5 dependants allowed.", variant: "destructive" });
      return;
    }
    setDependants([...dependants, newDep]);
    setNewDep({ fullName: "", relationship: "", dob: "", idNumber: "" });
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
      const ageInt = parseInt(formData.age);
      if (isNaN(ageInt)) throw new Error("Please enter a valid age.");

      // 1. Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'member',
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            age: ageInt,
            marketer_id: selectedMarketer?.id || null,
            marketer_code: selectedMarketer?.code || null
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed. Please try again.");

      // 2. Insert dependants
      if (dependants.length > 0) {
        const depsToInsert = dependants.map(d => ({
          member_id: authData.user!.id,
          full_name: d.fullName,
          relationship: d.relationship,
          dob: d.dob,
          id_number: d.idNumber
        }));

        const { error: depError } = await supabase.from("dependants").insert(depsToInsert);
        if (depError) console.error("Error adding dependants:", depError);
      }

      // 3. Generate and Send OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { error: otpError } = await supabase
        .from("otp_verifications")
        .insert({ phone: formData.phone, code: otpCode });

      if (otpError) throw otpError;

      try {
        await supabase.functions.invoke('send-sms', {
          body: {
            type: 'otp',
            phone: formData.phone,
            data: { code: otpCode }
          }
        });
      } catch (smsErr) {
        console.error("Failed to send OTP SMS:", smsErr);
      }

      toast({
        title: "Verification Code Sent",
        description: "Please enter the code sent to your phone to complete registration.",
      });
      
      navigate(`/verify-otp?phone=${encodeURIComponent(formData.phone)}`);
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

  const filteredMarketers = marketers.filter(m => 
    m.full_name.toLowerCase().includes(marketerSearch.toLowerCase()) ||
    m.code.toLowerCase().includes(marketerSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="card-elevated p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl">🐘</span>
            </div>
            <span className="text-xl font-serif font-bold text-foreground">Elephant Dental</span>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Member Registration</h1>
          <p className="text-muted-foreground mb-8">Join the Elephant Care Plan today.</p>

          <form onSubmit={handleRegister} className="space-y-8">
            {/* Personal Details */}
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
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" placeholder="25" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} required />
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

            {/* Referral Section */}
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

            {/* Dependants Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold">Add Dependants (Optional)</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsDependantModalOpen(true)}
                  disabled={dependants.length >= 5}
                >
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
                          <p className="text-xs text-muted-foreground">{dep.relationship} • {dep.dob} • ID: {dep.idNumber || 'N/A'}</p>
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

            {/* Consents */}
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

      {/* Marketer Selection Modal */}
      <Dialog open={isMarketerModalOpen} onOpenChange={setIsMarketerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Marketer</DialogTitle>
            <DialogDescription>Choose the agent who referred you to Elephant Dental.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or code..." 
                className="pl-9"
                value={marketerSearch}
                onChange={(e) => setMarketerSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
              {loadingMarketers ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading marketers...</p>
                </div>
              ) : filteredMarketers.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">No active marketers found.</p>
              ) : (
                filteredMarketers.map((m) => (
                  <div 
                    key={m.id} 
                    className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                    onClick={() => {
                      setSelectedMarketer(m);
                      setIsMarketerModalOpen(false);
                    }}
                  >
                    <div>
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.code}</p>
                    </div>
                    <Button size="sm" variant="ghost">Select</Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dependant Modal */}
      <Dialog open={isDependantModalOpen} onOpenChange={setIsDependantModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Dependant</DialogTitle>
            <DialogDescription>Enter the details of your family member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                placeholder="Dependant's Name" 
                value={newDep.fullName}
                onChange={(e) => setNewDep({ ...newDep, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Input 
                placeholder="e.g. Child, Spouse" 
                value={newDep.relationship}
                onChange={(e) => setNewDep({ ...newDep, relationship: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input 
                type="date" 
                value={newDep.dob}
                onChange={(e) => setNewDep({ ...newDep, dob: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Birth Cert / Student ID Number</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="ID or Certificate Number" 
                  className="pl-9"
                  value={newDep.idNumber}
                  onChange={(e) => setNewDep({ ...newDep, idNumber: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDependantModalOpen(false)}>Cancel</Button>
            <Button onClick={addDependant}>Add Dependant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Register;