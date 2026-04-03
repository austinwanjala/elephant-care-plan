import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, Download, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuperAgentCommissions() {
    const [commissions, setCommissions] = useState<any[]>([]);
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimLoading, setClaimLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadCommissions();
    }, []);

    const loadCommissions = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch all global super agent transactions regardless of limiting user_id
            const { data, error } = await supabase
                .from("super_agent_commissions" as any)
                .select(`
                    id, amount, status, created_at, marketer_id,
                    member:member_id (full_name, member_number, marketer_id)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            
            const fetchedCommissions = (data as any[]) || [];
            
            // Fetch marketer names manually
            const marketerIds = [...new Set(fetchedCommissions.map(c => c.marketer_id || c.member?.marketer_id).filter(Boolean))];
            const marketersMap: Record<string, string> = {};
            
            if (marketerIds.length > 0) {
                const { data: mData } = await supabase
                    .from("marketers")
                    .select("id, full_name")
                    .in("id", marketerIds);
                    
                mData?.forEach(m => {
                    marketersMap[m.id] = m.full_name;
                });
            }
            
            // Fetch claims history first
            const { data: claimsData } = await supabase
                .from("super_agent_claims" as any)
                .select("*")
                .order("created_at", { ascending: false });
                
            const fetchedClaims = (claimsData as any[]) || [];
            setClaims(fetchedClaims);
            
            const processedCommissions = fetchedCommissions.map(c => {
                const actMarketerId = c.marketer_id || c.member?.marketer_id;
                let actualStatus = c.status;

                // Sync historical status computationally with claims if there was a desync
                if (actualStatus !== 'paid') {
                    const resolvedByPaidClaim = fetchedClaims.some(claim => 
                        claim.status === 'paid' && new Date(claim.created_at) >= new Date(c.created_at)
                    );
                    if (resolvedByPaidClaim) {
                        actualStatus = 'paid';
                    }
                }

                return {
                    ...c,
                    status: actualStatus,
                    marketerName: actMarketerId ? (marketersMap[actMarketerId] || "Unknown") : "Platform"
                };
            });

            setCommissions(processedCommissions);

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        const unclaimed = commissions.filter(c => c.status === 'unclaimed');
        if (unclaimed.length === 0) {
            toast({ title: "No funds to claim", description: "You don't have any unclaimed commissions." });
            return;
        }

        setClaimLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const totalAmount = unclaimed.reduce((acc, curr) => acc + (curr.amount || 0), 0);

            // Create a claim
            const { error: claimError } = await supabase
                .from("super_agent_claims" as any)
                .insert({
                    super_agent_id: user.id,
                    amount: totalAmount,
                    referral_count: unclaimed.length,
                    status: 'pending'
                });

            if (claimError) throw claimError;

            // Update commissions dynamically
            const { error: updateError } = await supabase
                .from("super_agent_commissions" as any)
                .update({ status: 'pending' })
                .in("id", unclaimed.map(c => c.id));

            if (updateError) throw updateError;

            toast({ title: "Claim Submitted Successfully", description: `You have requested payout for KES ${totalAmount.toLocaleString()}` });
            
            // Instantly optimistically update the ledger visually right away so Available goes to exactly 0 to block multiclicks cleanly
            setCommissions(prev => prev.map(c => c.status === 'unclaimed' ? { ...c, status: 'pending' } : c));
            
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setClaimLoading(false);
        }
    };

    const unclaimedCommissions = commissions.filter(c => c.status === 'unclaimed');
    const unclaimedTotal = unclaimedCommissions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const pendingTotal = commissions.filter(c => c.status === 'pending' || c.status === 'finance_review').reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const paidTotal = commissions.filter(c => c.status === 'paid').reduce((acc, curr) => acc + (curr.amount || 0), 0);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in">
            <h1 className="text-3xl font-bold text-slate-800">My Commissions</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg border-0">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-100 flex items-center justify-between">
                            Available to Claim
                            <DollarSign className="h-4 w-4 opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black mb-1">KES {unclaimedTotal.toLocaleString()}</div>
                        <p className="text-xs text-indigo-200">{unclaimedCommissions.length} unbilled referrals</p>
                        <Button 
                            className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white border-white/10" 
                            variant="outline"
                            onClick={handleClaim}
                            disabled={claimLoading || unclaimedTotal === 0}
                        >
                            {claimLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                            Request Payout
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="w-1 h-full bg-amber-400 absolute left-0 top-0"></div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-amber-700 flex items-center justify-between">
                            Pending Approval
                            <ArrowRightCircle className="h-4 w-4 text-amber-500 opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">KES {pendingTotal.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Awaiting admin/finance review</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="w-1 h-full bg-emerald-500 absolute left-0 top-0"></div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-700 flex items-center justify-between">
                            Historically Paid
                            <DollarSign className="h-4 w-4 text-emerald-500 opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">KES {paidTotal.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Total lifetime withdrawn</p>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-indigo-500" />
                    Transaction Ledger
                </h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                            <TableRow>
                                <TableHead className="py-4 text-slate-600">Date Logged</TableHead>
                                <TableHead className="py-4 text-slate-600">Generated By (Marketer)</TableHead>
                                <TableHead className="py-4 text-slate-600">Client Reference</TableHead>
                                <TableHead className="py-4 text-slate-600">Your Cut</TableHead>
                                <TableHead className="py-4 text-slate-600">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {commissions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No commission transactions on your account yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                commissions.map((c) => (
                                    <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="text-slate-600 font-medium">
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {c.marketerName}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-semibold text-slate-800">{c.member?.full_name}</span>
                                            <span className="block text-xs text-slate-400">{c.member?.member_number}</span>
                                        </TableCell>
                                        <TableCell className="font-bold text-indigo-700">
                                            KES {c.amount?.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                c.status === 'unclaimed' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                                                (c.status === 'pending' || c.status === 'finance_review') ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                c.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                "bg-slate-50 text-slate-700 border-slate-200"
                                            }>
                                                {c.status.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Download className="h-5 w-5 text-indigo-500" />
                    Claims History
                </h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                            <TableRow>
                                <TableHead className="py-4 text-slate-600">Date Submitted</TableHead>
                                <TableHead className="py-4 text-slate-600">Referrals In Claim</TableHead>
                                <TableHead className="py-4 text-slate-600">Amount requested</TableHead>
                                <TableHead className="py-4 text-slate-600">Status</TableHead>
                                <TableHead className="py-4 text-slate-600">Paid Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {claims.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No claims submitted yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                claims.map((claim) => (
                                    <TableRow key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="text-slate-600 font-medium">
                                            {new Date(claim.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {claim.referral_count} referrals
                                        </TableCell>
                                        <TableCell className="font-bold text-indigo-700">
                                            KES {claim.amount?.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                claim.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                                                claim.status === 'rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                                "bg-amber-50 text-amber-700 border-amber-200"
                                            }>
                                                {claim.status.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-sm">
                                            {claim.paid_at ? new Date(claim.paid_at).toLocaleDateString() : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
