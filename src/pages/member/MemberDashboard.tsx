import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  Shield,
  History,
  Loader2,
  FileText,
  AlertCircle,
  DollarSign,
  Users,
  RefreshCw,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { InsuranceCard } from "@/components/member/InsuranceCard";

interface Member {
  id: string;
  member_number: string;
  full_name: string;
  phone: string;
  email: string;
  coverage_balance: number;
  total_contributions: number;
  benefit_limit: number;
  qr_code_data?: string | null;
  is_active: boolean;
  membership_categories: { name: string; benefit_amount: number } | null;
  id_number: string;
  marketers?: { full_name: string; code: string } | null;
  whatsapp_opt_in: boolean;
  insurance_card_token: string | null;
  scheme_start_at?: string | null;
  scheme_end_at?: string | null;
}

interface Visit {
  id: string;
  created_at: string;
  status: string;
  notes: string | null;
  branches: { name: string } | null;
  bills: {
    total_benefit_cost: number;
    total_real_cost: number;
    bill_items: { service_name: string }[]
  }[] | null;
}

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  mpesa_reference: string | null;
  status: string;
  payment_date: string;
}

interface Dependant {
  id: string;
  full_name: string;
  relationship: string;
  id_number: string;
}

const MemberDashboard = () => {
  const [member, setMember] = useState<Member | null>(null);
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ongoingTreatments, setOngoingTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadMemberData();
  }, []);

  const loadMemberData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      setLoading(false);
      return;
    }

    await Promise.all([
      fetchMemberProfile(user.id),
      fetchVisits(user.id),
      fetchPayments(user.id),
      fetchDependants(user.id),
      fetchOngoingTreatments(user.id),
    ]);
    setLoading(false);
  };

  const fetchMemberProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("members")
      .select("*, membership_categories(name, benefit_amount), marketers(full_name, code)")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching member profile:", error);
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
      setMember(null);
    } else if (data) {
      // UI-side fallback: if scheme has expired, trigger reset immediately.
      // The scheduled job also handles this daily.
      const schemeEnd = (data as any).scheme_end_at ? new Date((data as any).scheme_end_at) : null;
      if (schemeEnd && schemeEnd.getTime() < Date.now()) {
        try {
          await (supabase as any).rpc("expire_member_scheme_if_needed", { p_member_id: (data as any).id });
          const { data: refreshed } = await supabase
            .from("members")
            .select("*, membership_categories(name, benefit_amount), marketers(full_name, code)")
            .eq("user_id", userId)
            .single();
          if (refreshed) setMember(refreshed as unknown as Member);
          return;
        } catch {
          // If this fails, we still show the member as uncovered by checks below.
        }
      }

      setMember(data as unknown as Member);
    }
  };

  const fetchDependants = async (userId: string) => {
    const { data: memberData } = await supabase.from("members").select("id").eq("user_id", userId).single();
    if (memberData) {
      const { data } = await supabase.from("dependants").select("*").eq("member_id", memberData.id);
      if (data) setDependants(data);
    }
  }

  const fetchOngoingTreatments = async (userId: string) => {
    const { data: memberData } = await supabase.from("members").select("id").eq("user_id", userId).single();
    if (!memberData) return;

    const { data: rawStages } = await (supabase as any)
      .from("service_stages")
      .select("*")
      .eq("member_id", memberData.id)
      .eq("status", "in_progress");

    if (rawStages && rawStages.length > 0) {
      const serviceIds = [...new Set(rawStages.map((s: any) => s.service_id))];
      const { data: servicesData } = await (supabase as any)
        .from("services")
        .select("id, name")
        .in("id", serviceIds);
      const servicesMap: Record<string, any> = {};
      (servicesData || []).forEach((svc: any) => { servicesMap[svc.id] = svc; });
      setOngoingTreatments(rawStages.map((s: any) => ({ ...s, serviceName: servicesMap[s.service_id]?.name || 'Service' })));
    } else {
      setOngoingTreatments([]);
    }
  };

  const fetchVisits = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data, error } = await supabase
        .from("visits")
        .select(`*
          *, 
          branches(name), 
          bills(
            total_benefit_cost,
            total_real_cost,
            bill_items(service_name)
          )
        `)
        .eq("member_id", memberData.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (data) {
        setVisits(data as any);
      }
    }
  };

  const fetchPayments = async (userId: string) => {
    const { data: memberData } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (memberData) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", memberData.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) {
      } else if (data) {
        setPayments(data);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const coveragePercentage = member?.benefit_limit
    ? (member.coverage_balance / member.benefit_limit) * 100
    : 0;

  const schemeStartLabel = member?.scheme_start_at ? new Date(member.scheme_start_at).toLocaleDateString() : null;
  const schemeEndLabel = member?.scheme_end_at ? new Date(member.scheme_end_at).toLocaleDateString() : null;
  const schemeDaysLeft = member?.scheme_end_at
    ? Math.max(0, Math.ceil((new Date(member.scheme_end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Member Profile Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't load your member profile. Please contact support.
            </p>
            <Button onClick={() => navigate("/login")} className="btn-primary">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!member.is_active || !member.membership_categories) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="card-elevated p-8 text-center max-w-lg mx-auto">
          <CardHeader className="flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-accent mb-4" />
            <CardTitle className="text-2xl font-serif font-bold text-foreground mb-2">
              Membership Uncovered
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your membership is currently inactive. Please make your first payment to activate your dental coverage and access services.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/scheme-selection">
              <Button size="lg" className="btn-primary mt-4">
                <DollarSign className="mr-2 h-5 w-5" /> Select Scheme & Pay
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="dashboard-luxury-bg min-h-screen">
      <div className="soft-glow-emerald top-[5%] left-[-10%]" />
      <div className="soft-glow-blue bottom-[-5%] right-[-10%]" />

      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">Member Portal</h1>
            <p className="text-slate-500 mt-1 font-medium">Welcome back, {member.full_name}. Here is your cover summary.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl border-slate-200 bg-white/50 backdrop-blur-sm font-bold text-xs px-5 shadow-sm hover:bg-white" onClick={loadMemberData}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Sync Data
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-emerald-50/30 border-b border-emerald-100/50">
              <CardTitle className="text-xs font-black text-emerald-800 uppercase tracking-widest">Coverage Balance</CardTitle>
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-black text-slate-900">
                  KES {member?.coverage_balance?.toLocaleString() || 0}
                </div>
                <Badge className="bg-emerald-500 text-white border-0 font-bold px-3">Active Cover</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  <span>Balance Utilization</span>
                  <span>{coveragePercentage.toFixed(0)}% Left</span>
                </div>
                <Progress value={coveragePercentage} className="h-2 bg-slate-100" />
                <p className="text-[10px] font-bold text-slate-400 mt-2">
                  Of total KES {member?.benefit_limit?.toLocaleString() || 0} benefit limit
                </p>
              </div>
              <div className="mt-6">
                <Link to="/dashboard/scheme-selection">
                  <Button size="sm" variant="outline" className="w-full rounded-xl border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold text-xs h-10">
                    <CreditCard className="mr-2 h-4 w-4" /> Top up / Upgrade
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-blue-50/30 border-b border-blue-100/50">
              <CardTitle className="text-xs font-black text-blue-800 uppercase tracking-widest">Membership Status</CardTitle>
              <div className="p-2 bg-blue-100 rounded-xl">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-2xl font-black text-slate-900 capitalize mb-1">
                {member?.membership_categories?.name || "Standard Member"}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-4">
                ID: {member.member_number}
              </p>

              {schemeStartLabel && schemeEndLabel && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Validity Period</p>
                    {typeof schemeDaysLeft === "number" && (
                      <Badge className={cn(
                        "font-bold text-[9px] uppercase px-2 py-0.5 rounded-lg border-0 shadow-sm",
                        schemeDaysLeft <= 30 ? "bg-rose-500 text-white" : "bg-blue-600 text-white"
                      )}>
                        {schemeDaysLeft} DAYS REMAINING
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-600">{schemeStartLabel}</div>
                    <div className="h-px flex-1 bg-blue-200" />
                    <div className="text-xs font-bold text-slate-600">{schemeEndLabel}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-violet-50/30 border-b border-violet-100/50">
              <CardTitle className="text-xs font-black text-violet-800 uppercase tracking-widest">Usage History</CardTitle>
              <div className="p-2 bg-violet-100 rounded-xl">
                <Activity className="h-5 w-5 text-violet-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-5xl font-black text-slate-900 mb-2">{visits.length}</div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total medical sessions accessed
              </p>
              <div className="mt-8">
                <Button variant="outline" className="w-full rounded-xl text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100 font-bold text-xs h-10" onClick={() => document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' })}>
                  <History className="mr-2 h-4 w-4" /> View Detailed Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-8">
            <div className="transform transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
              {member && <InsuranceCard member={{
                id: member.id,
                full_name: member.full_name,
                member_number: member.member_number,
                membership_categories: member.membership_categories,
                insurance_card_token: member.insurance_card_token,
                is_active: member.is_active,
                coverage_balance: member.coverage_balance || 0,
                benefit_limit: member.benefit_limit || 0,
                id_number: member.id_number,
              }} />}
            </div>

            {/* Ongoing Treatment Panel */}
            {ongoingTreatments.length > 0 && (
              <Card className="border-blue-200 bg-white/70 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-blue-600 text-white pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Activity className="h-5 w-5 animate-pulse" />
                    Clinical Progress
                  </CardTitle>
                  <CardDescription className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Active Multi-Stage Treatment</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {ongoingTreatments.map((t: any) => {
                    const progress = Math.round((t.current_stage / t.total_stages) * 100);
                    const isNearComplete = t.current_stage + 1 === t.total_stages;
                    return (
                      <div key={t.id} className="bg-slate-50/80 rounded-2xl border border-slate-100 p-4 space-y-3 shadow-sm group hover:border-blue-300 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-black text-sm text-slate-900">{t.serviceName}</p>
                            {t.tooth_number && (
                              <p className="text-[10px] font-black text-blue-600 uppercase mt-1">Tooth Spec: #{t.tooth_number}</p>
                            )}
                          </div>
                          <Badge className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded-lg border-0",
                            isNearComplete ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                          )}>
                            {isNearComplete ? 'FINALIZING' : 'IN PROGRESS'}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            <span>Stage {t.current_stage} OF {t.total_stages} Complete</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex gap-1.5 pt-1">
                            {Array.from({ length: t.total_stages }, (_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "flex-1 h-1.5 rounded-full transition-colors",
                                  i < t.current_stage ? 'bg-blue-600' : 'bg-slate-200'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-400">NEXT: Stage {t.current_stage + 1} Assessment</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Dependants */}
            <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Users className="h-5 w-5 text-primary" />
                  Dependants
                </CardTitle>
                <CardDescription className="text-xs font-medium">Family members under your cover</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {dependants.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400 italic">No family members registered.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dependants.map((dep) => (
                      <div key={dep.id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-primary/30 transition-all group">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-black text-slate-800">{dep.full_name}</p>
                          <Badge variant="outline" className="capitalize text-[9px] font-black bg-slate-50 border-slate-200 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">{dep.relationship}</Badge>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID Number: {dep.id_number}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-10">
            <Card id="history-section" className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Activity className="h-5 w-5 text-primary" />
                  Clinical History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow className="hover:bg-transparent border-b-slate-100">
                        <TableHead className="font-bold text-slate-600 pl-6">Visit Date</TableHead>
                        <TableHead className="font-bold text-slate-600">Procedures & Care</TableHead>
                        <TableHead className="font-bold text-slate-600">Facility</TableHead>
                        <TableHead className="font-bold text-slate-600 pr-6 text-right">Benefit Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-16">
                            <div className="flex flex-col items-center gap-2">
                              <Activity className="h-10 w-10 text-primary opacity-10" />
                              <p className="text-slate-400 font-bold text-sm">No clinical services accessed yet.</p>
                              <p className="text-[10px] text-slate-400 uppercase font-medium">Your health journey begins at our clinics.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        visits.map((visit) => {
                          const isPending = visit.status !== 'completed';
                          const bill = visit.bills?.[0];
                          const serviceNames = isPending
                            ? "Processing Records..."
                            : (bill?.bill_items?.map(i => i.service_name).join(", ") || "General Consultation");

                          return (
                            <TableRow key={visit.id} className="group hover:bg-slate-50/50 transition-colors border-b-slate-50">
                              <TableCell className="pl-6">
                                <div className="font-black text-slate-800 text-sm">{new Date(visit.created_at).toLocaleDateString()}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">{new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-slate-700 text-xs leading-relaxed">{serviceNames}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-xs font-bold text-slate-600">{visit.branches?.name || "Care Unit"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="pr-6 text-right font-black text-rose-600 text-sm">
                                {isPending ? "-" : `KES ${(bill?.total_benefit_cost || 0).toLocaleString()}`}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <Shield className="h-5 w-5 text-primary" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/30 border border-emerald-100/50">
                    <div className="space-y-1">
                      <div className="text-sm font-black text-emerald-900">WhatsApp Updates</div>
                      <div className="text-[10px] text-emerald-700/70 font-bold uppercase">Clinical Notifications</div>
                    </div>
                    <Switch
                      checked={member.whatsapp_opt_in}
                      onCheckedChange={async (checked) => {
                        const { error } = await (supabase as any)
                          .from("members")
                          .update({ whatsapp_opt_in: checked })
                          .eq("id", member.id);

                        if (error) {
                          toast({ title: "Update failed", description: error.message, variant: "destructive" });
                        } else {
                          setMember({ ...member, whatsapp_opt_in: checked });
                          toast({ title: "Preferences updated", description: `WhatsApp notifications ${checked ? 'enabled' : 'disabled'}` });
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-xl border-slate-100 shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payments
                  </CardTitle>
                  <Badge className="bg-slate-900 text-[9px] font-black uppercase">Recent</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {payments.length === 0 ? (
                      <div className="p-10 text-center italic text-slate-400 text-xs">No records found.</div>
                    ) : (
                      payments.slice(0, 3).map((p) => (
                        <div key={p.id} className="p-4 border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-black text-slate-800 text-sm">KES {p.amount.toLocaleString()}</span>
                            <Badge className="bg-emerald-100 text-emerald-700 text-[9px] font-black border-0 uppercase">Success</Badge>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span className="uppercase">{new Date(p.payment_date).toLocaleDateString()}</span>
                            <span className="font-mono">{p.mpesa_reference}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberDashboard;