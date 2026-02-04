import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    idNumber: "",
    age: "",
    email: "",
    password: "",
  });
  const [consents, setConsents] = useState({
    processing: false,
    sharing: false,
    signature: false,
  });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

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

    setLoading(true);

    try {
      const ageInt = parseInt(formData.age);
      if (isNaN(ageInt)) {
        throw new Error("Please enter a valid age.");
      }

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
          }
        }
      });

      if (authError) throw authError;

      // Send Welcome SMS via Edge Function
      try {
        await supabase.functions.invoke('send-sms', {
          body: {
            type: 'welcome',
            phone: formData.phone,
            data: { name: formData.fullName }
          }
        });
      } catch (smsErr) {
        console.error("Failed to send welcome SMS:", smsErr);
      }

      toast({
        title: "Registration successful!",
        description: "Your account has been created. Please login to select your membership scheme.",
      });
      
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

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
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
          <p className="text-muted-foreground mb-8">Create your account to access dental coverage and manage your health investment.</p>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="0712 345 678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">National ID / Passport Number</Label>
                <Input
                  id="idNumber"
                  placeholder="12345678"
                  value={formData.idNumber}
                  onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="input-field"
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-border">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="processing" 
                  checked={consents.processing}
                  onCheckedChange={(checked) => setConsents({ ...consents, processing: !!checked })}
                />
                <Label htmlFor="processing" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I consent to the processing of my personal data for membership administration.
                </Label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="sharing" 
                  checked={consents.sharing}
                  onCheckedChange={(checked) => setConsents({ ...consents, sharing: !!checked })}
                />
                <Label htmlFor="sharing" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I authorize Elephant Dental to share my medical information with its affiliated branches.
                </Label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="signature" 
                  checked={consents.signature}
                  onCheckedChange={(checked) => setConsents({ ...consents, signature: !!checked })}
                />
                <Label htmlFor="signature" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I acknowledge that checking this box constitutes my digital signature.
                </Label>
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary py-6 text-lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;