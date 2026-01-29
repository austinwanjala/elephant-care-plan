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
  LogOut,
  Loader2,
  User,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

interface StaffInfo {
  id: string;
  full_name: string;
  branch_id: string | null;
  branches: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  real_cost: number;
  branch_compensation: number;
  benefit_cost: number;
  profit_loss: number;
  approval_type: "all_branches" | "pre_approved_only";
}

interface Visit {
  id: string;
  benefit_deducted: number;
  branch_compensation: number;
  profit_loss: number;
  created_at: string;
  services: { name: string } | null;
  members: { full_name: string; member_number: string } | null;
}

interface BranchStats {
  todayVisits: number;
  todayRevenue: number;
  todayDeductions: number;
  todayProfitLoss: number;
}

const StaffDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [preapprovedServiceIds, setPreapprovedServiceIds] = useState<string[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStats>({
    todayVisits: 0,
    todayRevenue: 0,
    todayDeductions: 0,
    todayProfitLoss: 0,
  });
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadStaffDataAndRelatedInfo();
  }, []);

  const loadStaffDataAndRelatedInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: staffData } = await supabase
      .from("staff")
      .select("*, branches(name)")
      .eq("user_id", user.id)
      .single();

    if (staffData) {
      setStaffInfo(staffData);
      await Promise.all([
        loadServices(staffData.branch_id),
        loadRecentVisits(staffData.branch_id),
        loadBranchStats(staffData.branch_id),
      ]);
    } else {
      toast({
        title: "Staff profile not found",
        description: "Please contact support.",
        variant: "destructive",
      });
      navigate("/dashboard"); // Fallback if staff profile is missing
    }

    setLoading(false);
  };

  const loadServices = async (branchId: string | null) => {
    const { data: servicesData } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (servicesData) {
      setServices(servicesData);
    }

    // Load pre-approved services for this branch
    if (branchId) {
      const { data: preapprovals } = await supabase
        .from("service_preapprovals")
        .select("service_id")
        .eq("branch_id", branchId);

      if (preapprovals) {
        setPreapprovedServiceIds(preapprovals.map((p) => p.service_id));
      }
    }
  };

  const loadRecentVisits = async (branchId: string | null) => {
    if (!branchId) return;

    const { data } = await supabase
      .from("visits")
      .select("*, services(name), members(full_name, member_number)")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setRecentVisits(data);
  };

  const loadBranchStats = async (branchId: string | null) => {
    if (!branchId) return;

    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("branch_revenue")
      .select("*")
      .eq("branch_id", branchId)
      .eq("date", today)
      .maybeSingle();

    if (data) {
      setBranchStats({
        todayVisits: data.visit_count,
        todayRevenue: data.total_compensation,
        todayDeductions: data.total_benefit_deductions,
        todayProfitLoss: data.total_profit_loss,
      });
    } else {
      setBranchStats({
        todayVisits: 0,
        todayRevenue: 0,
        todayDeductions: 0,
        todayProfitLoss: 0,
      });
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
      const { error } = await supabase.from("visits").insert({
        member_id: selectedMember.id,
        branch_id: staffInfo.branch_id,
        service_id: selectedService.id,
        staff_id: staffInfo.id,
        benefit_deducted: selectedService.benefit_cost,
        branch_compensation: selectedService.branch_compensation,
        profit_loss: selectedService.profit_loss,
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

      // Reload data
      await Promise.all([
        loadRecentVisits(staffInfo.branch_id),
        loadBranchStats(staffInfo.branch_id),
      ]);
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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Branch Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branchStats.todayVisits}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Branch Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                KES {branchStats.todayRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Benefit Deductions</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KES {branchStats.todayDeductions.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit/Loss</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${branchStats.todayProfitLoss >= 0 ? "text-success" : "text-destructive"}`}>
                KES {branchStats.todayProfitLoss.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

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

        {/* Recent Visits */}
        <div className="card-elevated overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent Services
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Benefit Deducted</TableHead>
                  <TableHead>Branch Comp.</TableHead>
                  <TableHead>Profit/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No services processed yet today
                    </TableCell>
                  </TableRow>
                ) : (
                  recentVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>
                        {new Date(visit.created_at).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{visit.members?.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {visit.members?.member_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{visit.services?.name}</TableCell>
                      <TableCell className="text-destructive">
                        -KES {visit.benefit_deducted.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-success">
                        +KES {visit.branch_compensation.toLocaleString()}
                      </TableCell>
                      <TableCell className={visit.profit_loss >= 0 ? "text-success" : "text-destructive"}>
                        KES {visit.profit_loss.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Service Selection Dialog */}
        <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif">Select Service</DialogTitle>
              <DialogDescription>
                Choose a service for {selectedMember?.full_name}
              </DialogDescription>
            </DialogHeader>

            {selectedMember && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Member Info */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{selectedMember.full_name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {selectedMember.member_number}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4 text-success" />
                      <span className="text-sm text-muted-foreground">Available</span>
                    </div>
                    <p className="text-xl font-bold text-success">
                      KES {selectedMember.coverage_balance.toLocaleString()}
                    </p>
                  </div>
                </div>

                {!selectedService ? (
                  <ScrollArea className="flex-1 pr-4">
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
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold mb-3">{selectedService.name}</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Benefit Cost:</span>
                          <p className="font-bold text-lg">KES {selectedService.benefit_cost.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Branch Compensation:</span>
                          <p className="font-bold text-lg text-success">KES {selectedService.branch_compensation.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Profit/Loss:</span>
                          <p className={`font-bold text-lg ${selectedService.profit_loss >= 0 ? "text-success" : "text-destructive"}`}>
                            KES {selectedService.profit_loss.toLocaleString()}
                          </p>
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
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default StaffDashboard;