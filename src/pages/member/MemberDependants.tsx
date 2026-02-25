import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Trash, Users, Camera, User, ImagePlus, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const calculateAge = (dob: string) => {
  if (!dob) return 0;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

interface Dependant {
  id: string;
  full_name: string;
  dob: string;
  id_number: string | null;
  relationship: string | null;
  gender: string | null;
  image_url: string | null;
}

const MemberDependants = () => {
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDependant, setNewDependant] = useState({
    fullName: "",
    dob: "",
    idNumber: "",
    relationship: "",
    gender: "male",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDependants();
  }, []);

  const fetchDependants = async () => {
    setLoading(true);
    setFetchError(null);
    try {
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
        console.error("Member fetch error:", memberError);
        throw new Error("Could not load your member profile. Please contact support.");
      }

      if (memberData) {
        setMemberId(memberData.id);
        const { data, error: depError } = await supabase
          .from("dependants")
          .select("*")
          .eq("member_id", memberData.id)
          .order("full_name", { ascending: true });

        if (depError) {
          console.error("Dependants fetch error:", depError);
          throw new Error("Failed to load dependants list.");
        }
        setDependants(data || []);
      } else {
        setFetchError("Member profile not linking to this account.");
      }
    } catch (err: any) {
      console.error("Error fetching dependants:", err);
      // Ensure error message is not blank
      const msg = err.message || "An unexpected error occurred.";
      setFetchError(msg);
      toast({
        title: "Error loading dependants",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDependant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    if (dependants.length >= 5) {
      toast({ title: "Limit Reached", description: "Maximum 5 dependants allowed.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${memberId}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('dependant-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          if (uploadError.message.includes("bucket not found")) {
            // Log but don't block dependant creation if image fails (optional)
            console.error("Storage bucket issue:", uploadError);
            toast({ title: "Image Upload Failed", description: "Could not upload photo. Proceeding without it.", variant: "secondary" });
          } else {
            throw uploadError;
          }
        } else {
          const { data: { publicUrl } } = supabase.storage.from('dependant-images').getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      const { error } = await supabase.from("dependants").insert({
        member_id: memberId,
        full_name: newDependant.fullName,
        dob: newDependant.dob,
        id_number: newDependant.idNumber,
        relationship: newDependant.relationship,
        gender: newDependant.gender,
        image_url: imageUrl
      });

      if (error) throw error;

      toast({ title: "Dependant Added", description: `${newDependant.fullName} has been added.` });
      setDialogOpen(false);
      setNewDependant({ fullName: "", dob: "", idNumber: "", relationship: "", gender: "male" });
      setImageFile(null);
      fetchDependants();
    } catch (error: any) {
      toast({ title: "Error adding dependant", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    try {
      const { error } = await supabase.from("dependants").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Dependant Removed", description: `${name} has been removed.` });
      fetchDependants();
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

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <div className="text-center">
          <h3 className="font-semibold text-lg">Unable to load dependants</h3>
          <p className="text-muted-foreground">{fetchError}</p>
        </div>
        <Button variant="outline" onClick={fetchDependants}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Dependants</h1>
          <p className="text-muted-foreground">Manage family members covered under your scheme</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Registered Dependants</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="btn-primary" disabled={dependants.length >= 5}><Plus className="mr-2 h-4 w-4" /> Add Dependant</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Dependant</DialogTitle>
                <DialogDescription>Enter the details of your family member to add them to your scheme.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDependant} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={newDependant.fullName} onChange={(e) => setNewDependant({ ...newDependant, fullName: e.target.value })} required placeholder="e.g. Jane Doe" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Date of Birth *</Label>
                      {newDependant.dob && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {calculateAge(newDependant.dob)} yrs
                        </span>
                      )}
                    </div>
                    <Input type="date" max={new Date().toISOString().split("T")[0]} value={newDependant.dob} onChange={e => setNewDependant({ ...newDependant, dob: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship *</Label>
                    <Input value={newDependant.relationship} onChange={(e) => setNewDependant({ ...newDependant, relationship: e.target.value })} placeholder="e.g. Child" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Birth Cert / ID Number *</Label>
                    <Input value={newDependant.idNumber} onChange={(e) => setNewDependant({ ...newDependant, idNumber: e.target.value })} required placeholder="Enter ID" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={newDependant.gender}
                      onChange={(e) => setNewDependant({ ...newDependant, gender: e.target.value })}
                      required
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dependant Photo (Optional)</Label>
                  <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                    {imageFile ? (
                      <div className="relative">
                        <Avatar className="h-16 w-16 border">
                          <AvatarImage src={URL.createObjectURL(imageFile)} />
                          <AvatarFallback><User /></AvatarFallback>
                        </Avatar>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                          onClick={() => setImageFile(null)}
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Label htmlFor="image-upload" className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                        <ImagePlus className="h-4 w-4" />
                        {imageFile ? "Change Photo" : "Choose Image"}
                      </Label>
                      <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG or WebP. Max 2MB.</p>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add Dependant
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {dependants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No dependants registered yet.</p>
              </div>
            ) : (
              dependants.map((dep) => (
                <Card key={dep.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={dep.image_url || ""} />
                      <AvatarFallback>{dep.full_name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{dep.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dep.relationship || "N/A"} • {calculateAge(dep.dob)} yrs • {dep.gender || "N/A"} • ID: {dep.id_number || "N/A"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(dep.id, dep.full_name)}>
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberDependants;