import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [referralSource, setReferralSource] = useState<string>("none");
  const [availableMarketers, setAvailableMarketers] = useState<Marketer[]>([]);
  const [selectedMarketerId, setSelectedMarketerId] = useState<string | null>(null);
  const [consents, setConsents] = useState({ processing: false, sharing: false, signature: false });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fetchMarketers = async () => {
      const { data } = await supabase.from("marketers").select("id, full_name, code").eq("is_active", true).order("full_name");
      if (data) {
        setAvailableMarketers(data);
        const refCode = searchParams.get("ref");
        if (refCode) {
          const refM = data.find(m => m.code === refCode);
          if (refM) { setReferralSource("marketer"); setSelectedMarketerId(refM.id); }
        }
      }
    };
    fetchMarketers();
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consents.processing || !consents.sharing || !consents.signature) {
      toast({ title: "Please accept all consents", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const ageInt = parseInt(formData.age);
      if (isNaN(ageInt)) throw new Error("Please enter a valid age.");

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'member',
            full_name: formData.fullName,
            phone: formData.phone,
            id_number: formData.idNumber,
            age: ageInt,
            marketer_id: selectedMarketerId,
          }
        }
      });

      if (authError) throw authError;

      toast({ title: "Registration successful!", description: "Please login to select your scheme." });
      navigate("/login");
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
        <div className="card-elevated p-8">
          <h1 className="text-3xl font-serif font-bold mb-2">Member Registration</h1>
          <p className="text-muted-foreground mb-8">Create your account to access dental coverage.</p>
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label>Full Name</Label><Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Phone Number</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required /></div>
              <div className="space-y-2"><Label>ID Number</Label><Input value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Age</Label><Input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6} /></div>
              <div className="space-y-2 md:col-span-2">
                <Label>How did you hear about us?</Label>
                <Select value={referralSource} onValueChange={v => { setReferralSource(v); if (v !== "marketer") setSelectedMarketerId(null); }}>
                  <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="marketer">Marketer</SelectItem>
                    <SelectItem value="friend">Friend/Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {referralSource === "marketer" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Select Marketer</Label>
                  <Select value={selectedMarketerId || ""} onValueChange={v => setSelectedMarketerId(v)} required>
                    <SelectTrigger><SelectValue placeholder="Choose a marketer" /></SelectTrigger>
                    <SelectContent>{availableMarketers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-4 pt-6 border-t">
              <div className="flex items-start space-x-3">
                <Checkbox id="c1" checked={consents.processing} onCheckedChange={v => setConsents({...consents, processing: !!v})} />
                <Label htmlFor="c1" className="text-xs">I consent to data processing for membership administration.</Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox id="c2" checked={consents.sharing} onCheckedChange={v => setConsents({...consents, sharing: !!v})} />
                <Label htmlFor="c2" className="text-xs">I authorize sharing medical info with affiliated branches.</Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox id="c3" checked={consents.signature} onCheckedChange={v => setConsents({...consents, signature: !!v})} />
                <Label htmlFor="c3" className="text-xs">I acknowledge this as my digital signature.</Label>
              </div>
            </div>
            <Button type="submit" className="w-full btn-primary" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Register Member"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;