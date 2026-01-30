import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Building2, Stethoscope, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom"; // Import useNavigate

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface Service {
  id: string;
  name: string;
  benefit_cost: number;
  approval_type: "all_branches" | "pre_approved_only";
}

interface Member {
  id: string;
  coverage_balance: number | null;
  benefit_limit: number | null;
}

const MIN_COVERAGE_THRESHOLD = 500; // Define a minimum coverage threshold

export default function MemberClaims() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchServicesForBranch(selectedBranch);
    } else {
      setServices([]);
    }
    setSelectedService("");
  }, [selectedBranch]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [branchesRes, memberRes] = await Promise.all([
        supabase.from("branches").select("id, name, location").eq("is_active", true),
        supabase.from("members").select("id, coverage_balance, benefit_limit").eq("user_id", user.id).maybeSingle()
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (memberRes.data) {
        setMember(memberRes.data);
        // Redirect to payment simulation if coverage is too low
        if ((memberRes.data.coverage_balance || 0) < MIN_COVERAGE_THRESHOLD) {
          toast({
            title: "Low Coverage Alert",
            description: "Your coverage balance is low. Please top up to access services.",
            variant: "destructive",
          });
          navigate("/dashboard/pay");
          return; // Stop further loading on this page
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServicesForBranch = async (branchId: string) => {
    try {
      // Fetch services available at all branches
      const allBranchServicesRes = await supabase
        .from("services")
        .select("id, name, benefit_cost, approval_type")
        .eq("approval_type", "all_branches")
        .eq("is_active", true);

      // Fetch pre-approved services for this specific branch
      const preapprovedRes = await supabase
        .from("service_preapprovals")
        .select("service_id, services(id, name, benefit_cost, approval_type)")
        .eq("branch_id", branchId);

      const allBranchServices = allBranchServicesRes.data || [];
      const preapprovedServices = preapprovedRes.data
        ?.map(p => p.services)
        .filter((s): s is Service => s !== null) || [];

      // Combine and deduplicate
      const serviceMap = new Map<string, Service>();
      [...allBranchServices, ...preapprovedServices].forEach(s => {
        if (s) serviceMap.set(s.id, s);
      });

      setServices(Array.from(serviceMap.values()));
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!member || !selectedBranch || !selectedService || !diagnosis) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const service = services.find(s => s.id === selectedService);
    if (!service) return;

    if ((member.coverage_balance || 0) < service.benefit_cost) {
      toast({
        title: "Insufficient Coverage",
        description: "Your coverage balance is insufficient. Please make a payment first.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("claims").insert({
        member_id: member.id,
        branch_id: selectedBranch,
        amount: service.benefit_cost,
        diagnosis,
        treatment: service.name,
        notes: notes || null,
        status: "pending"
      });

      if (error) throw error;

      toast({
        title: "Claim Submitted",
        description: "Your claim has been submitted for review.",
      });

      // Reset form
      setSelectedBranch("");
      setSelectedService("");
      setDiagnosis("");
      setNotes("");
      // Re-fetch member data to update coverage balance on the UI
      fetchInitialData(); 
    } catch (error: any) { // Explicitly type error as any to access .message
      console.error("Error submitting claim:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit claim. Please try again.", // Use error.message
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedServiceData = services.find(s => s.id === selectedService);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Submit a Claim</h1>
        <p className="text-muted-foreground">Choose a hospital and service to submit your claim</p>
      </div>

      {member && (member.coverage_balance || 0) < MIN_COVERAGE_THRESHOLD && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your coverage balance is low (KES {(member.coverage_balance || 0).toLocaleString()}). 
            Please <Button variant="link" className="p-0 h-auto text-destructive" onClick={() => navigate("/dashboard/pay")}>top up</Button> to access services.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            New Claim
          </CardTitle>
          <CardDescription>
            Select a hospital to see available services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Select Hospital
              </Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a hospital..." />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} - {branch.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBranch && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Select Service
                </Label>
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No services available at this hospital.</p>
                ) : (
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - KES {service.benefit_cost.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {selectedServiceData && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Service Cost:</span>
                    <span className="font-semibold">KES {selectedServiceData.benefit_cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">Your Balance:</span>
                    <span className={`font-semibold ${(member?.coverage_balance || 0) < selectedServiceData.benefit_cost ? 'text-destructive' : 'text-green-600'}`}>
                      KES {(member?.coverage_balance || 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Diagnosis / Reason for Visit</Label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g., Toothache, Routine checkup"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={3}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitting || !selectedBranch || !selectedService || !diagnosis}
            >
              {submitting ? "Submitting..." : "Submit Claim"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}