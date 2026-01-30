import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, User, Phone, Mail, CreditCard } from "lucide-react";
import { InsuranceCard } from "@/components/member/InsuranceCard"; // New import

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
  is_active: boolean; // Added is_active
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
        {/* Member Card - Replaced with InsuranceCard */}
        {profile && (
          <div className="md:col-span-1">
            <InsuranceCard member={{
              full_name: profile.full_name,
              member_number: profile.member_number,
              membership_categories: profile.membership_categories,
              qr_code_data: profile.qr_code_data,
              is_active: profile.is_active,
              coverage_balance: profile.coverage_balance || 0,
              benefit_limit: profile.benefit_limit || 0,
              id_number: profile.id_number, // Pass id_number
            }} />
          </div>
        )}

        {/* Coverage Card - This remains as is */}
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