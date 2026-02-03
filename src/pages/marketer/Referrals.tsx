import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Users, CalendarDays, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

export default function MarketerReferrals() {
    const [loading, setLoading] = useState(true);
    const [referredMembers, setReferredMembers] = useState<ReferredMember[]>([]);
    const [marketerId, setMarketerId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchMarketerInfo();
    }, []);

    useEffect(() => {
        if (marketerId) {
            fetchReferredMembers(marketerId);
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
            toast({ title: "Account Error", description: "Marketer profile not found. Please contact admin.", variant: "destructive" });
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

        if (error) {
            toast({ title: "Error fetching referrals", description: error.message, variant: "destructive" });
            setReferredMembers([]);
        } else {
            setReferredMembers(data || []);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketer">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Referrals</h1>
                    <p className="text-muted-foreground">Detailed list of members you have referred.</p>
                </div>
            </div>

            <Card className="shadow-sm border-blue-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" /> Referred Members
                    </CardTitle>
                    <CardDescription>Total: {referredMembers.length}</CardDescription>
                </CardHeader>
                <CardContent>
                    {referredMembers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No members referred yet. Share your link to get started!</p>
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
                                                <Badge variant={member.is_active ? "default" : "secondary"} className={member.is_active ? "bg-green-600" : ""}>
                                                    {member.is_active ? "Active" : "Inactive"}
                                                </Badge>
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
        </div>
    );
}