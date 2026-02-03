import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Users, History, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReferredMember {
    id: string;
    full_name: string;
    member_number: string;
    email: string;
    phone: string;
    created_at: string;
    is_active: boolean;
    coverage_balance: number;
    membership_categories: { name: string } | null;
}

interface ReferralActivity {
    id: string;
    created_at: string;
    status: string;
    members: { full_name: string; member_number: string };
    branches: { name: string };
    bills: { total_benefit_cost: number; bill_items: { service_name: string }[] }[];
}

export default function MarketerReferrals() {
    const [loading, setLoading] = useState(true);
    const [referredMembers, setReferredMembers] = useState<ReferredMember[]>([]);
    const [activities, setActivities] = useState<ReferralActivity[]>([]);
    const [marketerId, setMarketerId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchMarketerInfo();
    }, []);

    useEffect(() => {
        if (marketerId) {
            fetchReferredMembers(marketerId);
            fetchReferralActivity(marketerId);
        }
    }, [marketerId]);

    const fetchMarketerInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: mData, error: mError } = await supabase
            .from("marketers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (mError || !mData) {
            toast({ title: "Account Error", description: "Marketer profile not found.", variant: "destructive" });
            navigate("/marketer");
            return;
        }
        setMarketerId(mData.id);
    };

    const fetchReferredMembers = async (id: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from("members")
            .select("id, full_name, member_number, email, phone, created_at, is_active, coverage_balance, membership_categories(name)")
            .eq("marketer_id", id)
            .order("created_at", { ascending: false });

        if (!error) setReferredMembers(data || []);
        setLoading(false);
    };

    const fetchReferralActivity = async (id: string) => {
        const { data, error } = await supabase
            .from("visits")
            .select("*, members!inner(full_name, member_number), branches(name), bills(total_benefit_cost, bill_items(service_name))")
            .eq("members.marketer_id", id)
            .order("created_at", { ascending: false })
            .limit(50);

        if (!error) setActivities(data as any || []);
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketer">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Referrals</h1>
                    <p className="text-muted-foreground">Detailed list of members you have referred and their activity.</p>
                </div>
            </div>

            <Tabs defaultValue="members" className="w-full">
                <TabsList className="bg-muted p-1 rounded-lg">
                    <TabsTrigger value="members" className="flex items-center gap-2"><Users className="h-4 w-4" /> Referred Members</TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-2"><History className="h-4 w-4" /> Referral Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="mt-6">
                    <Card className="shadow-sm border-blue-100">
                        <CardHeader>
                            <CardTitle>Referred Members ({referredMembers.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {referredMembers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No members referred yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px] divide-y divide-border">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground">
                                                <th className="py-3 pr-3 font-semibold">Name</th>
                                                <th className="py-3 px-3 font-semibold">Member #</th>
                                                <th className="py-3 px-3 font-semibold">Joined Date</th>
                                                <th className="py-3 px-3 font-semibold">Status</th>
                                                <th className="py-3 pl-3 font-semibold text-right">Coverage</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {referredMembers.map(member => (
                                                <tr key={member.id} className="hover:bg-muted/50">
                                                    <td className="py-3 pr-3 text-sm font-medium">{member.full_name}</td>
                                                    <td className="py-3 px-3 text-sm font-mono">{member.member_number}</td>
                                                    <td className="py-3 px-3 text-sm">{format(new Date(member.created_at), 'MMM d, yyyy')}</td>
                                                    <td className="py-3 px-3 text-sm">
                                                        <Badge variant={member.is_active ? "default" : "secondary"} className={member.is_active ? "bg-green-600" : ""}>{member.is_active ? "Active" : "Inactive"}</Badge>
                                                    </td>
                                                    <td className="py-3 pl-3 text-sm font-medium text-right">KES {member.coverage_balance.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="mt-6">
                    <Card className="shadow-sm border-blue-100">
                        <CardHeader>
                            <CardTitle>Recent Activity from Referrals</CardTitle>
                            <CardDescription>Track when your referred members visit the hospital.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {activities.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No activity recorded for your referrals.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px] divide-y divide-border">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground">
                                                <th className="py-3 pr-3 font-semibold">Date</th>
                                                <th className="py-3 px-3 font-semibold">Member</th>
                                                <th className="py-3 px-3 font-semibold">Branch</th>
                                                <th className="py-3 px-3 font-semibold">Services</th>
                                                <th className="py-3 pl-3 font-semibold text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {activities.map(activity => (
                                                <tr key={activity.id} className="hover:bg-muted/50">
                                                    <td className="py-3 pr-3 text-sm">{format(new Date(activity.created_at), 'MMM d, yyyy')}</td>
                                                    <td className="py-3 px-3 text-sm">
                                                        <div className="font-medium">{activity.members.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">{activity.members.member_number}</div>
                                                    </td>
                                                    <td className="py-3 px-3 text-sm">{activity.branches?.name || 'N/A'}</td>
                                                    <td className="py-3 px-3 text-sm max-w-[200px] truncate">
                                                        {activity.bills?.[0]?.bill_items?.map(i => i.service_name).join(", ") || 'Consultation'}
                                                    </td>
                                                    <td className="py-3 pl-3 text-sm text-right">
                                                        <Badge variant="outline" className="capitalize">{activity.status.replace('_', ' ')}</Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}