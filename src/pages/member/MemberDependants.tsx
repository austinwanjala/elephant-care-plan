import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Trash, Users, CalendarDays, CreditCard, Upload, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Dependant {
  id: string;
  full_name: string;
  dob: string;
  id_number: string;
  relationship: string;
  image_url: string | null;
}

const MemberDependants = () => {
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDependant, setNewDependant] = useState({
    fullName: "",
    dob: "",
    idNumber: "",
    relationship: "",
    imageUrl: "",
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

    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberData) {
      setMemberId(memberData.id);
      const { data } = await supabase
        .from("dependants")
        .select("*")
        .eq("member_id", memberData.id)
        .order("full_name", { ascending: true });

      setDependants(data || []);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !memberId) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${memberId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('dependants')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('dependants')
        .getPublicUrl(filePath);

      setNewDependant({ ...newDependant, imageUrl: publicUrl });
      toast({ title: "Image Uploaded", description: "Dependant photo ready." });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleAddDependant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    if (dependants.length >= 5) {
      toast({ title: "Limit Reached", description: "Max 5 dependants allowed.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("dependants").insert({
        member_id: memberId,
        full_name: newDependant.fullName,
        dob: newDependant.dob,
        id_number: newDependant.idNumber,
        relationship: newDependant.relationship,
        image_url: newDependant.imageUrl || null
      });

      if (error) throw error;

      toast({ title: "Dependant Added", description: "Family member registered successfully." });
      setDialogOpen(false);
      setNewDependant({ fullName: "", dob: "", idNumber: "", relationship: "", imageUrl: "" });
      fetchDependants();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDependant = async (id: string) => {
    if (!confirm("Remove this dependant?")) return;
    await supabase.from("dependants").delete().eq("id", id);
    fetchDependants();
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div>
          <h1 className="text-3xl font-bold">My Dependants</h1>
          <p className="text-muted-foreground">Manage family members covered under your scheme</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Registered Dependants</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" disabled={dependants.length >= 5}><Plus className="mr-2 h-4 w-4" /> Add Dependant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Dependant</DialogTitle>
                <DialogDescription>Upload a photo and enter details for your family member.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDependant} className="grid gap-4 py-4">
                <div className="flex flex-col items-center gap-4 mb-4">
                  <Avatar className="h-24 w-24 border-2 border-primary/20">
                    <AvatarImage src={newDependant.imageUrl} />
                    <AvatarFallback><User className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <div className="relative">
                    <Input type="file" accept="image/*" className="hidden" id="dep-image" onChange={handleImageUpload} disabled={uploading} />
                    <Label htmlFor="dep-image" className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                        <span>{uploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />} Upload Photo</span>
                      </Button>
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newDependant.fullName} onChange={(e) => setNewDependant({ ...newDependant, fullName: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={newDependant.dob} onChange={(e) => setNewDependant({ ...newDependant, dob: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Input value={newDependant.relationship} onChange={(e) => setNewDependant({ ...newDependant, relationship: e.target.value })} placeholder="e.g. Child" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ID / Birth Cert Number</Label>
                  <Input value={newDependant.idNumber} onChange={(e) => setNewDependant({ ...newDependant, idNumber: e.target.value })} required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting || uploading}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Dependant"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {dependants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No dependants added yet.</div>
          ) : (
            <div className="grid gap-4">
              {dependants.map((dep) => (
                <Card key={dep.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={dep.image_url || undefined} />
                      <AvatarFallback>{dep.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{dep.full_name}</p>
                      <p className="text-sm text-muted-foreground">{dep.relationship}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {dep.dob}</span>
                      <span className="flex items-center gap-1"><CreditCard className="h-4 w-4" /> {dep.id_number}</span>
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