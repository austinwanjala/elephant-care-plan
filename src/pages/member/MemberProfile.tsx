import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, User, Phone, Mail, CreditCard, Cake, Users, Pencil, Save, X } from "lucide-react";
import { InsuranceCard } from "@/components/member/InsuranceCard";
import { differenceInYears, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import FingerprintCaptureModal from "@/components/biometrics/FingerprintCaptureModal";

interface MemberProfile {
  id: string;
  member_number: string;
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  age: number | null;
  dob: string | null;
  coverage_balance: number | null;
  benefit_limit: number | null;
  total_contributions: number | null;
  qr_code_data?: string | null;
  is_active: boolean;
  membership_categories: { name: string; level: string } | null;
  marketers: { full_name: string; code: string } | null;
}

export default function MemberProfile() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [biometricOpen, setBiometricOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    id_number: "",
    dob: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("members")
      .select("*, membership_categories(name, level), marketers(full_name, code)")
      .eq("user_id", user.id)
      .maybeSingle();

    setProfile(data);
    if (data) {
      setEditForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        id_number: data.id_number || "",
        dob: data.dob || "",
      });
    }
    setLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("members")
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
          id_number: editForm.id_number,
          dob: editForm.dob || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({ title: "Profile Updated", description: "Your details have been saved." });
      setIsEditOpen(false);
      fetchProfile(); // Refresh data
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Profile not found</p>
        </CardContent>
      </Card>
    );
  }

  const coveragePercent = profile.benefit_limit
    ? ((profile.coverage_balance || 0) / profile.benefit_limit) * 100
    : 0;

  const displayAge = profile.dob
    ? differenceInYears(new Date(), parseISO(profile.dob))
    : (profile.age || "N/A");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Your membership details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setBiometricOpen(true)} className="gap-2">
            <span className="inline-block h-4 w-4 rounded-full bg-primary/20" />
            Register New Biometric
          </Button>
          <Button onClick={() => setIsEditOpen(true)} variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" /> Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {profile && (
          <div className="md:col-span-1">
            <InsuranceCard member={{
              full_name: profile.full_name,
              member_number: profile.member_number,
              membership_categories: profile.membership_categories,
              qr_code_data: profile.qr_code_data || null,
              is_active: profile.is_active,
              coverage_balance: profile.coverage_balance || 0,
              benefit_limit: profile.benefit_limit || 0,
              id_number: profile.id_number,
            }} />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Coverage Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-2xl font-bold">
                  KES {(profile.coverage_balance || 0).toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  / KES {(profile.benefit_limit || 0).toLocaleString()}
                </span>
              </div>
              <Progress value={coveragePercent} className="h-3" />
            </div>
            <p className="text-sm text-muted-foreground">
              Total Contributions: KES {(profile.total_contributions || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p>{profile.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p>{profile.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">ID Number</p>
              <p>{profile.id_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Cake className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Age</p>
              <p>{displayAge} {profile.dob && <span className="text-xs text-slate-400">({profile.dob})</span>}</p>
            </div>
          </div>
          {profile.marketers && (
            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l sm:pl-4 pt-4 sm:pt-0 sm:col-span-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Referred By</p>
                <p className="font-medium text-primary">
                  {profile.marketers.full_name} ({profile.marketers.code})
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id_number">ID Number</Label>
              <Input
                id="id_number"
                value={editForm.id_number}
                onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={editForm.dob}
                onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                required
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fingerprint enrollment modal */}
      {profile && (
        <FingerprintCaptureModal
          open={biometricOpen}
          onOpenChange={setBiometricOpen}
          mode="enroll"
          entityType="member"
          entityId={profile.id}
        />
      )}
    </div>
  );
}