import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, User, Phone, Mail, CreditCard } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface MemberProfile {
  id: string;
  member_number: string;
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  coverage_balance: number | null;
  benefit_limit: number | null;
  total_contributions: number | null;
  qr_code_data: string | null;
  membership_categories: { name: string; level: string } | null;
}

export default function MemberProfile() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("members")
      .select("*, membership_categories(name, level)")
      .eq("user_id", user.id)
      .maybeSingle();

    setProfile(data);
    setLoading(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Your membership details</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Member Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-4">
                <div>
                  <p className="text-sm opacity-80">Member Number</p>
                  <p className="text-xl font-bold">{profile.member_number}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{profile.full_name}</p>
                  <p className="text-sm opacity-80">
                    {profile.membership_categories?.name || "Standard Member"}
                  </p>
                </div>
              </div>
              {profile.qr_code_data && (
                <div className="bg-white p-2 rounded">
                  <QRCodeSVG value={profile.qr_code_data} size={80} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coverage Card */}
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

      {/* Personal Info */}
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
        </CardContent>
      </Card>
    </div>
  );
}
