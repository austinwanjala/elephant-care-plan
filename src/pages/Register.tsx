import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface MembershipCategory {
  id: string;
  name: string;
  payment_amount: number;
  benefit_amount: number;
  registration_fee: number;
  management_fee: number;
}

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
    password: "",
    nextOfKinName: "",
    nextOfKinPhone: "",
    branchId: "",
    categoryId: "",
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [branchesRes, categoriesRes] = await Promise.all([
      supabase.from("branches").select("id, name, location").eq("is_active", true),
      supabase.from("membership_categories").select("*").eq("is_active", true).order("payment_amount"),
    ]);
    
    if (branchesRes.data) setBranches(branchesRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.categoryId) {
      toast({
        title: "Please select a membership category",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const category = categories.find((c) => c.id === formData.categoryId);
      if (!category) throw new Error("Invalid category");

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // 2. Create member profile with initial zero coverage and inactive status
      const { error: memberError } = await supabase.from("members").insert({
        user_id: authData.user.id,
        member_number: "TEMP", // Will be overwritten by trigger
        full_name: formData.fullName,
        phone: formData.phone,
        id_number: formData.idNumber,
        email: formData.email,
        next_of_kin_name: formData.nextOfKinName || null,
        next_of_kin_phone: formData.nextOfKinPhone || null,
        branch_id: formData.branchId || null,
        membership_category_id: formData.categoryId,
        benefit_limit: category.benefit_amount, // Store benefit limit, but coverage starts at 0
        coverage_balance: 0, // Start with 0 coverage
        total_contributions: 0, // Start with 0 contributions
        is_active: false, // Member is inactive until first payment
        qr_code_data: null, // QR code generated after first payment
      });

      if (memberError) throw memberError;

      // 3. Assign member role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "member",
      });

      if (roleError) throw roleError;

      toast({
        title: "Registration successful!",
        description: `Welcome to Elephant Dental. Please make your first payment to activate your ${category.name} membership.`,
      });

      navigate("/dashboard/pay"); // Redirect to payment page
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
      <div className="max-w-2xl mx-auto">
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
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Join Elephant Dental</h1>
          <p className="text-muted-foreground mb-8">
            Register to start enjoying premium dental coverage
          </p>

          <form onSubmit={handleRegister} className="space-y-6">
            {/* Membership Category Selection */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Select Membership Level *</Label>
              <div className="grid md:grid-cols-2 gap-3">
                {categories.map((category) => (
                  <Card
                    key={category.id}
                    className={`cursor-pointer transition-all ${
                      formData.categoryId === category.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => handleChange("categoryId", category.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        {formData.categoryId === category.id && (
                          <span className="text-primary text-lg">✓</span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment:</span>
                          <span className="font-medium">KES {category.payment_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Benefit:</span>
                          <span className="font-medium text-success">KES {category.benefit_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {selectedCategory && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-primary">Payment Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Membership:</span>
                    <span>KES {selectedCategory.payment_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registration Fee:</span>
                    <span>KES {selectedCategory.registration_fee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Management Fee:</span>
                    <span>KES {selectedCategory.management_fee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary col-span-2 border-t pt-2">
                    <span>Total Payment:</span>
                    <span>KES {(selectedCategory.payment_amount + selectedCategory.registration_fee + selectedCategory.management_fee).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-success border-t pt-2">
                  <span>Your Initial Coverage:</span>
                  <span>KES {selectedCategory.benefit_amount.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  placeholder="0712345678"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number *</Label>
                <Input
                  id="idNumber"
                  placeholder="12345678"
                  value={formData.idNumber}
                  onChange={(e) => handleChange("idNumber", e.target.value)}
                  required
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                  minLength={6}
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Preferred Branch</Label>
                <Select onValueChange={(value) => handleChange("branchId", value)}>
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextOfKinName">Next of Kin Name</Label>
                <Input
                  id="nextOfKinName"
                  placeholder="Jane Doe"
                  value={formData.nextOfKinName}
                  onChange={(e) => handleChange("nextOfKinName", e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextOfKinPhone">Next of Kin Phone</Label>
                <Input
                  id="nextOfKinPhone"
                  placeholder="0712345678"
                  value={formData.nextOfKinPhone}
                  onChange={(e) => handleChange("nextOfKinPhone", e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <Button type="submit" className="w-full btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
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