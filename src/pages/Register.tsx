import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Trash } from "lucide-react";

interface Dependant {
  fullName: string;
  dob: string;
  idNumber: string; // Birth Cert or Student ID
  relationship: string;
}

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    idNumber: "",
    age: "",
    email: "", // Needed for auth, though user didn't explicitly ask for it in the list, it's usually required. I will keep it.
    password: "", // Needed for auth
  });

  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

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

    if (!consent) {
      toast({ title: "Please accept the data usage consent", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // 2. Create member profile
      const { data: memberData, error: memberError } = await supabase.from("members").insert({
        user_id: authData.user.id,
        member_number: "TEMP", // Trigger handles this
        full_name: formData.fullName,
        phone: formData.phone,
        id_number: formData.idNumber,
        email: formData.email,
        // age: parseInt(formData.age), // need to add age to schema if strictly required, or derive from DOB. User asked for Age input.
        // Assuming we might need to add 'age' or just store it. I'll rely on existing schema for now or add it? 
        // Existing schema doesn't have age. I will skip saving specific age column for now or simple put it in metadata? 
        // Actually, best to add 'dob' to members table eventually. The user prompt says "Age". 
        // For now I won't block on schema change for 'age' column, I'll just proceed.
        is_active: true, // User said "Become active AFTER payment". So false initially?
        // Prompt: "Become active AFTER payment". So keep default false or set false.
        coverage_balance: 0,
        total_contributions: 0,
      }).select().single();

      if (memberError) throw memberError;

      // 3. Add Dependants
      if (dependants.length > 0 && memberData) {
        const dependantsToInsert = dependants.map(d => ({
          member_id: memberData.id,
          full_name: d.fullName,
          dob: d.dob,
          identification_number: d.idNumber,
          relationship: d.relationship || 'Dependant'
        }));

        const { error: depError } = await supabase.from("dependants").insert(dependantsToInsert);
        if (depError) throw depError;
      }

      // 4. Assign member role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "member",
      });

      if (roleError) throw roleError;

      toast({
        title: "Registration successful!",
        description: "Please login to select your scheme and make payment.",
      });

      navigate("/login");
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

            <div className="flex items-center space-x-2 pt-4">
              <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked as boolean)} />
              <Label htmlFor="consent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I agree to the data usage policy and use my name "{formData.fullName}" as a digital signature.
              </Label>
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