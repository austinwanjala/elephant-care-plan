import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash, Users, ArrowRight } from "lucide-react";

const RegisterDependants = () => {
  const [dependants, setDependants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [newDep, setNewDep] = useState({
    fullName: "",
    dob: "",
    idNumber: "",
    relationship: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberData) {
      setMemberId(memberData.id);
      fetchDependants(memberData.id);
    } else {
      navigate("/login");
    }
    setLoading(false);
  };

  const fetchDependants = async (id: string) => {
    const { data } = await supabase
      .from("dependants")
      .select("*")
      .eq("member_id", id);
    if (data) setDependants(data);
  };

  const handleAddDependant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    if (dependants.length >= 5) {
      toast({ title: "Limit reached", description: "Maximum 5 dependants allowed.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("dependants").insert({
        member_id: memberId,
        full_name: newDep.fullName,
        dob: newDep.dob,
        id_number: newDep.idNumber,
        relationship: newDep.relationship,
      });

      if (error) throw error;

      toast({ title: "Dependant added" });
      setNewDep({ fullName: "", dob: "", idNumber: "", relationship: "" });
      fetchDependants(memberId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("dependants").delete().eq("id", id);
    if (memberId) fetchDependants(memberId);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold mb-2">Add Your Dependants</h1>
          <p className="text-muted-foreground">You can add up to 5 family members to your coverage.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Dependant</CardTitle>
            <CardDescription>Enter details for a family member.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDependant} className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newDep.fullName} onChange={e => setNewDep({...newDep, fullName: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Input placeholder="e.g. Spouse, Child" value={newDep.relationship} onChange={e => setNewDep({...newDep, relationship: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={newDep.dob} onChange={e => setNewDep({...newDep, dob: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>ID / Birth Cert #</Label>
                  <Input value={newDep.idNumber} onChange={e => setNewDep({...newDep, idNumber: e.target.value})} required />
                </div>
              </div>
              <Button type="submit" variant="outline" disabled={submitting || dependants.length >= 5}>
                {submitting ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Dependant
              </Button>
            </form>
          </CardContent>
        </Card>

        {dependants.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Users className="h-5 w-5" /> Registered Dependants</h3>
            {dependants.map((dep) => (
              <Card key={dep.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{dep.full_name}</p>
                  <p className="text-xs text-muted-foreground">{dep.relationship} • {dep.id_number}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(dep.id)}>
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Button size="lg" className="btn-primary px-12" onClick={() => navigate("/dashboard/scheme-selection")}>
            Continue to Scheme Selection <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RegisterDependants;