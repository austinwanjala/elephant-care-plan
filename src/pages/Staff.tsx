import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CheckCircle,
  AlertCircle,
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

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  qr_code_data: string;
}

interface StaffInfo {
  id: string;
  full_name: string;
  branch_id: string | null;
  branches: { name: string } | null;
}

interface Claim {
  id: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  status: string;
  created_at: string;
  members: { full_name: string; member_number: string } | null;
}

const Staff = () => {
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);
  const [claimForm, setClaimForm] = useState({
    diagnosis: "",
    treatment: "",
    amount: "",
  });
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if user is staff
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "staff" && roleData?.role !== "admin") {
      toast({
        title: "Access denied",
        description: "You don't have staff privileges",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    // Load staff info
    const { data: staffData } = await supabase
      .from("staff")
      .select("*, branches(name)")
      .eq("user_id", user.id)
      .single();

    if (staffData) {
      setStaffInfo(staffData);
      loadRecentClaims(staffData.id);
    }

    setLoading(false);
  };

  const loadRecentClaims = async (staffId: string) => {
    const { data } = await supabase
      .from("claims")
      .select("*, members(full_name, member_number)")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setRecentClaims(data);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    try {
      const { data, error } = await supabase
        .from("members")
        .select("*")
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
    setClaimDialogOpen(true);
    setClaimForm({ diagnosis: "", treatment: "", amount: "" });
  };

  const handleSubmitClaim = async () => {
    if (!selectedMember || !staffInfo) return;

    const amount = parseFloat(claimForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > selectedMember.coverage_balance) {
      toast({
        title: "Insufficient coverage",
        description: `Member only has KES ${selectedMember.coverage_balance.toLocaleString()} available`,
        variant: "destructive",
      });
      return;
    }

    setSubmittingClaim(true);

    try {
      const { error } = await supabase.from("claims").insert({
        member_id: selectedMember.id,
        branch_id: staffInfo.branch_id,
        staff_id: staffInfo.id,
        diagnosis: claimForm.diagnosis,
        treatment: claimForm.treatment,
        amount: amount,
        status: "completed",
        processed_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Claim processed!",
        description: `KES ${amount.toLocaleString()} deducted from ${selectedMember.full_name}'s coverage`,
      });

      setClaimDialogOpen(false);
      setSelectedMember(null);
      setSearchResults([]);
      setSearchQuery("");
      loadRecentClaims(staffInfo.id);
    } catch (error: any) {
      toast({
        title: "Claim failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      completed: "badge-success",
      pending: "badge-warning",
      rejected: "badge-error",
    };
    return badges[status] || "badge-warning";
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
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl">🐘</span>
            </div>
            <div>
              <span className="text-xl font-serif font-bold text-foreground">Elephant Dental</span>
              <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">Staff</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground hidden sm:block">
              {staffInfo?.full_name} • {staffInfo?.branches?.name}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="card-elevated p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">Claim Processing</h1>
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
                      <p className="text-sm text-muted-foreground font-mono">{member.member_number}</p>
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

        {/* Recent Claims */}
        <div className="card-elevated overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent Claims
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No claims processed yet today
                    </TableCell>
                  </TableRow>
                ) : (
                  recentClaims.map((claim) => (
                    <TableRow key={claim.id} className="table-row-hover">
                      <TableCell>
                        {new Date(claim.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{claim.members?.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {claim.members?.member_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{claim.diagnosis}</TableCell>
                      <TableCell>{claim.treatment}</TableCell>
                      <TableCell>KES {claim.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(claim.status)}`}>
                          {claim.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Claim Dialog */}
        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Process Claim</DialogTitle>
              <DialogDescription>
                Enter treatment details for {selectedMember?.full_name}
              </DialogDescription>
            </DialogHeader>

            {selectedMember && (
              <div className="space-y-6 pt-4">
                {/* Member Info */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
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

                {/* Claim Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="diagnosis">Diagnosis *</Label>
                    <Input
                      id="diagnosis"
                      placeholder="e.g., Dental Cavity"
                      value={claimForm.diagnosis}
                      onChange={(e) => setClaimForm({ ...claimForm, diagnosis: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="treatment">Treatment *</Label>
                    <Textarea
                      id="treatment"
                      placeholder="e.g., Tooth filling with composite material"
                      value={claimForm.treatment}
                      onChange={(e) => setClaimForm({ ...claimForm, treatment: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (KES) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0"
                      value={claimForm.amount}
                      onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
                      className="input-field"
                    />
                    {parseFloat(claimForm.amount) > selectedMember.coverage_balance && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Amount exceeds available coverage
                      </p>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {claimForm.amount && parseFloat(claimForm.amount) > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current balance:</span>
                      <span>KES {selectedMember.coverage_balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Claim amount:</span>
                      <span className="text-destructive">
                        -KES {parseFloat(claimForm.amount).toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-medium">
                      <span>New balance:</span>
                      <span className={selectedMember.coverage_balance - parseFloat(claimForm.amount) >= 0 ? "text-success" : "text-destructive"}>
                        KES {(selectedMember.coverage_balance - parseFloat(claimForm.amount)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSubmitClaim}
                  disabled={
                    submittingClaim ||
                    !claimForm.diagnosis ||
                    !claimForm.treatment ||
                    !claimForm.amount ||
                    parseFloat(claimForm.amount) > selectedMember.coverage_balance
                  }
                  className="w-full btn-primary"
                >
                  {submittingClaim ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Process Claim
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Staff;
