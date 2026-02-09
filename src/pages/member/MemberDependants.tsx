import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Trash, Users, Camera, User, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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
  const [newDependant, setNewDependant] = useState({
    fullName: "",
    dob: "",
    idNumber: "",
    relationship: "",
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: memberData } = await supabase.from("members").select("id").eq("user_id", user.id).maybeSingle();

    if (memberData) {
      setMemberId(memberData.id);
      const { data } = await supabase.from("dependants").select("*").eq("member_id", memberData.id).order("full_name", { ascending: true });
      setDependants(data || []);
    }
    setLoading(false);
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
            throw new Error("Storage bucket 'dependant-images' not found. Please contact administrator to create it.");
          }
          throw uploadError;
        }
        
        const { data: { publicUrl } } = supabase.storage.from('dependant-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("dependants").insert({
        member_id: memberId,
        full_name: newDependant.fullName,
        dob: newDependant.dob,
        id_number: newDependant.idNumber,
        relationship: newDependant.relationship,
        image_url: imageUrl
      });

      if (error) throw error;

      toast({ title: "Dependant Added", description: `${newDependant.fullName} has been added.` });
      setDialogOpen(false);
      setNewDependant({ fullName: "", dob: "", idNumber: "", relationship: "" });
      setImageFile(null);
      fetchDependants();
    } catch (error: any) {
      toast({ title: "Error adding dependant", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
                    <Label>Date of Birth *</Label>
                    <Input type="date" max={new Date().toISOString().split("T")[0]} value={newDependant.dob} onChange={e => setNewDependant({ ...newDependant, dob: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship *</Label>
                    <Input value={newDependant.relationship} onChange={(e) => setNewDependant({ ...newDependant, relationship: e.target.value })} placeholder="e.g. Child" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Birth Cert / ID Number *</Label>
                  <Input value={newDependant.idNumber} onChange={(e) => setNewDependant({ ...newDependant, idNumber: e.target.value })} required placeholder="Enter identification number" />
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
                      <AvatarFallback>{dep.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{dep.full_name}</p>
                      <p className="text-xs text-muted-foreground">{dep.relationship} • ID: {dep.id_number}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={async () => { 
                    if (confirm(`Are you sure you want to remove ${dep.full_name}?`)) { 
                      await supabase.from("dependants").delete().eq("id", dep.id); 
                      fetchDependants(); 
                    } 
                  }}>
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