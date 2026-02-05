import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Trash, Users, CalendarDays, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

interface Dependant {
  id: string;
  full_name: string;
  dob: string;
  identification_number: string;
  relationship: string;
}

const MemberDependants = () => {
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDependant, setNewDependant] = useState({
    fullName: "",
    dob: "",
    idNumber: "",
    relationship: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDependants();
  }, []);

  const fetchDependants = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      toast({
        title: "Error loading member data",
        description: memberError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (memberData) {
      setMemberId(memberData.id);
      const { data: dependantsData, error: dependantsError } = await supabase
        .from("dependants")
        .select("*")
        .eq("member_id", memberData.id)
        .order("full_name", { ascending: true });

      if (dependantsError) {
        toast({
          title: "Error loading dependants",
          description: dependantsError.message,
          variant: "destructive",
        });
      } else {
        setDependants(dependantsData || []);
      }
    } else {
      toast({
        title: "Member profile not found",
        description: "Please contact support.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleAddDependant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    if (dependants.length >= 5) {
      toast({ title: "Maximum Dependants Reached", description: "You can add a maximum of 5 dependants per scheme.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("dependants").insert({
        member_id: memberId,
        full_name: newDependant.fullName,
        dob: newDependant.dob,
        identification_number: newDependant.idNumber,
        relationship: newDependant.relationship,
      });

      if (error) throw error;

      toast({ title: "Dependant Added", description: `${newDependant.fullName} has been added.` });
      setDialogOpen(false);
      setNewDependant({ fullName: "", dob: "", idNumber: "", relationship: "" });
      fetchDependants(); // Refresh list
    } catch (error: any) {
      toast({ title: "Error adding dependant", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDependant = async (dependantId: string) => {
    if (!confirm("Are you sure you want to remove this dependant?")) return;

    try {
      const { error } = await supabase.from("dependants").delete().eq("id", dependantId);
      if (error) throw error;

      toast({ title: "Dependant Removed", description: "Dependant has been successfully removed." });
      fetchDependants(); // Refresh list
    } catch (error: any) {
      toast({ title: "Error removing dependant", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!memberId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Could not load member details. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Dependants</h1>
          <p className="text-muted-foreground">Manage family members covered under your scheme</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Registered Dependants
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" disabled={dependants.length >= 5}>
                <Plus className="mr-2 h-4 w-4" /> Add Dependant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Dependant</DialogTitle>
                <DialogDescription>
                  Enter the details for your new dependant.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDependant} className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="depFullName">Full Name</Label>
                  <Input
                    id="depFullName"
                    value={newDependant.fullName}
                    onChange={(e) => setNewDependant({ ...newDependant, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depDob">Date of Birth</Label>
                  <Input
                    id="depDob"
                    type="date"
                    value={newDependant.dob}
                    onChange={(e) => setNewDependant({ ...newDependant, dob: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depIdNumber">Birth Cert / Student ID</Label>
                  <Input
                    id="depIdNumber"
                    value={newDependant.idNumber}
                    onChange={(e) => setNewDependant({ ...newDependant, idNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depRelationship">Relationship</Label>
                  <Input
                    id="depRelationship"
                    value={newDependant.relationship}
                    onChange={(e) => setNewDependant({ ...newDependant, relationship: e.target.value })}
                    placeholder="e.g., Child, Spouse"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Dependant"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {dependants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No dependants added yet. Click "Add Dependant" to get started.
            </div>
          ) : (
            <div className="grid gap-4">
              {dependants.map((dep) => (
                <Card key={dep.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(dep.full_name || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{dep.full_name || "Unknown Name"}</p>
                      <p className="text-sm text-muted-foreground">{dep.relationship || "Dependant"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" /> {dep.dob || "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-4 w-4" /> {dep.identification_number || "N/A"}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteDependant(dep.id)}>
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberDependants;