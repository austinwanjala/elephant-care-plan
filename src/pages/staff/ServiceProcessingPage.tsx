import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  QrCode,
  Search,
  Loader2,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  Mail,
  Phone,
  Fingerprint,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  qr_code_data: string;
  membership_categories: { name: string } | null;
  id_number: string;
  benefit_limit: number;
  total_contributions: number;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  biometric_data: string | null;
}

interface StaffInfo {
  id: string;
  full_name: string;
  branch_id: string | null;
  branches: { name: string; is_globally_preapproved_for_services: boolean | null } | null; // Added global pre-approval
}

interface Service {
  id: string;
  name: string;
  real_cost: number;
  branch_compensation: number;
  benefit_cost: number;
  approval_type: "all_branches" | "pre_approved_only";
}

const ServiceProcessingPage = () => {
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [preapprovedServiceIds, setPreapprovedServiceIds] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadStaffDataAndServices();
  }, []);

  const loadStaffDataAndServices = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*, branches(name, is_globally_preapproved_for_services)") // Fetch global pre-approval
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffError) {
      toast({
        title: "Error loading staff profile",
        description: staffError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (staffData) {
      setStaffInfo(staffData);
      if (staffData.branch_id) {
        await loadServices(staffData.branch_id, staffData.branches?.is_globally_preapproved_for_services || false);
      } else {
        setServices([]);
      }
    } else {
      toast({
        title: "Staff profile not found",
        description: "Please contact support. Redirecting to dashboard.",
        variant: "destructive",
      });
      navigate("/staff"); // Redirect to staff dashboard if profile not found
    }

    setLoading(false);
  };

  const loadServices = async (branchId: string | null, isGloballyPreapproved: boolean) => {
    const { data: servicesData } = await supabase
      .from("services")
      .select("id, name, real_cost, branch_compensation, benefit_cost, approval_type")
      .eq("is_active", true)
      .order("name");

    if (servicesData) {
      setServices(servicesData);
    }

    if (branchId && !isGloballyPreapproved) { // Only load specific pre-approvals if not globally pre-approved
      const { data: preapprovals } = await supabase
        .from("service_preapprovals")
        .select("service_id")
        .eq("branch_id", branchId);

      if (preapprovals) {
        setPreapprovedServiceIds(preapprovals.map((p) => p.service_id));
      }
    } else if (isGloballyPreapproved) {
      // If globally pre-approved, all 'pre_approved_only' services are considered available
      setPreapprovedServiceIds(servicesData?.filter(s => s.approval_type === "pre_approved_only").map(s => s.id) || []);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    try {
      const { data, error } = await supabase
        .from("members")
        .select("*, membership_categories(name)")
        .or(`member_number.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,qr_code_data.eq.${searchQuery}`)
        .eq("is_active", true)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);

      if (data?.length === 0) {
        toast({
          title: "No results",
          description: "No member found with that search query",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setServiceDialogOpen(true);
    setSelectedService(null);
    setNotes("");
  };

  const isServiceAvailable = (service: Service): boolean => {
    if (service.approval_type === "all_branches") return true;
    
    // Check global pre-approval first
    if (staffInfo?.branches?.is_globally_preapproved_for_services) {
      return true;
    }
    
    // Fallback to individual service pre-approvals
    return preapprovedServiceIds.includes(service.id);
  };

  const canAffordService = (service: Service): boolean => {
    if (!selectedMember) return false;
    return selectedMember.coverage_balance >= service.benefit_cost;
  };

  const handleSelectService = (service: Service) => {
    if (!isServiceAvailable(service)) {
      toast({
        title: "Service not available",
        description: "This service requires pre-approval for your branch",
        variant: "destructive",
      });
      return;
    }

    if (!canAffordService(service)) {
      toast({
        title: "Insufficient coverage",
        description: `Member only has KES ${selectedMember?.coverage_balance.toLocaleString()} available`,
        variant: "destructive",
      });
      return;
    }

    setSelectedService(service);
  };

  const handleProcessService = async () => {
    if (!selectedMember || !selectedService || !staffInfo?.branch_id) return;

    setSubmitting(true);

    try {
      const profitLoss = selectedService.benefit_cost - selectedService.branch_compensation;
      const { error } = await supabase.from("visits").insert({
        member_id: selectedMember.id,
        branch_id: staffInfo.branch_id,
        service_id: selectedService.id,
        staff_id: staffInfo.id,
        benefit_deducted: selectedService.benefit_cost,
        branch_compensation: selectedService.branch_compensation,
        profit_loss: profitLoss,
        notes: notes || null,
      });

      if (error) throw error;

      toast({
        title: "Service processed!",
        description: `${selectedService.name} - KES ${selectedService.benefit_cost.toLocaleString()} deducted from ${selectedMember.full_name}'s coverage`,
      });

      setServiceDialogOpen(false);
      setSelectedMember(null);
      setSelectedService(null);
      setSearchResults([]);
      setSearchQuery("");

      // Optionally reload data on the dashboard if needed, or navigate back
      // For now, just clear the form and close dialog
    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staffInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Staff Profile Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't load your staff profile. This might mean your user account is not linked to a staff entry, or there was a database issue.
            </p>
            <Button onClick={() => navigate("/login")} className="btn-primary">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!staffInfo.branch_id) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Branch Not Assigned
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your staff profile is not assigned to a branch. Please contact your administrator to assign a branch.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Section */}
      <div className="card-elevated p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <QrCode className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Service Processing</h1>
            <p className="text-muted-foreground">Search member by QR code, member number, name, or phone</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Scan QR code or enter member number / name / phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-11 h-12 text-lg input-field"
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="btn-primary h-12 px-8">
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              {searchResults.length} member(s) found
            </p>
            {searchResults.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => handleSelectMember(member)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{member.full_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono">{member.member_number}</span>
                      {member.membership_categories && (
                        <Badge variant="outline">{member.membership_categories.name}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Coverage Balance</p>
                  <p className={`text-xl font-bold ${member.coverage_balance > 0 ? "text-success" : "text-destructive"}`}>
                    KES {member.coverage_balance.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Selection Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif">Select Service</DialogTitle>
            <DialogDescription>
              Choose a service for {selectedMember?.full_name}
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Member Info - Enhanced display */}
              <Card className="p-4 bg-muted/50 rounded-lg mb-4">
                <CardHeader className="p-0 pb-2 border-b border-border mb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {selectedMember.full_name}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground font-mono">
                    {selectedMember.member_number} - {selectedMember.membership_categories?.name || "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{selectedMember.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium">{selectedMember.phone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID Number:</span>
                    <p className="font-medium">{selectedMember.id_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Coverage:</span>
                    <p className="font-medium text-success">KES {selectedMember.coverage_balance.toLocaleString()}</p>
                  </div>
                  {selectedMember.next_of_kin_name && (
                    <div>
                      <span className="text-muted-foreground">Next of Kin:</span>
                      <p className="font-medium">{selectedMember.next_of_kin_name}</p>
                    </div>
                  )}
                  {selectedMember.next_of_kin_phone && (
                    <div>
                      <span className="text-muted-foreground">NOK Phone:</span>
                      <p className="font-medium">{selectedMember.next_of_kin_phone}</p>
                    </div>
                  )}
                  {selectedMember.biometric_data && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Fingerprint className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Biometric:</span>
                      <p className="font-medium text-success">Captured</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {!selectedService ? (
                <ScrollArea className="flex-1 pr-4 always-show-scrollbar min-h-[200px]">
                  <div className="grid md:grid-cols-2 gap-3">
                    {services.map((service) => {
                      const available = isServiceAvailable(service);
                      const affordable = canAffordService(service);

                      return (
                        <div
                          key={service.id}
                          className={`p-4 rounded-lg border transition-colors ${
                            available && affordable
                              ? "border-primary hover:bg-primary/5 cursor-pointer"
                              : "border-border/50 opacity-60 cursor-not-allowed"
                          }`}
                          onClick={() => available && affordable && handleSelectService(service)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium">{service.name}</p>
                            {!available && (
                              <Badge variant="secondary" className="text-xs">Pre-approval needed</Badge>
                            )}
                            {available && !affordable && (
                              <Badge variant="destructive" className="text-xs">Insufficient funds</Badge>
                            )}
                            {available && affordable && (
                              <Badge className="bg-success text-xs">Available</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Benefit Cost:</span>
                              <p className="font-semibold">KES {service.benefit_cost.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Branch Comp:</span>
                              <p className="font-semibold text-success">KES {service.branch_compensation.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="flex-1 pr-4 always-show-scrollbar min-h-[200px]">
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold mb-3">{selectedService.name}</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Benefit Cost:</span>
                          <p className="font-bold text-lg">KES {selectedService.benefit_cost.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Branch Compensation:</span>
                          <p className="font-bold text-lg text-success">KES {selectedService.branch_compensation.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Textarea
                        placeholder="Add any notes about this service..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current balance:</span>
                        <span>KES {selectedMember.coverage_balance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deduction:</span>
                        <span className="text-destructive">
                          -KES {selectedService.benefit_cost.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>New balance:</span>
                        <span className="text-success">
                          KES {(selectedMember.coverage_balance - selectedService.benefit_cost).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedService(null)}
                      >
                        Back to Services
                      </Button>
                      <Button
                        className="flex-1 btn-primary"
                        onClick={handleProcessService}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Process Service
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceProcessingPage;