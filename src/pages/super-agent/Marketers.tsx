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
import { Loader2, Users } from "lucide-react";

export default function SuperAgentMarketers() {
    const [marketers, setMarketers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        loadMarketers();
    }, []);

    const loadMarketers = async () => {
        setLoading(true);
        try {
            // Use RPC to bypass row-level-security gracefully and fetch pre-counted active field agents.
            const { data, error } = await supabase.rpc("super_agent_get_marketers");

            if (error) throw error;
            
            // Map the RPC row names to match the component format
            const mappedData = (data || []).map((m: any) => ({
                id: m.user_id,
                user_id: m.user_id,
                staff: [{ full_name: m.full_name, is_active: m.is_active }],
                total_members: m.total_members || 0
            }));

            setMarketers(mappedData);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-3 rounded-xl border border-indigo-200 shadow-sm">
                    <Users className="h-6 w-6 text-indigo-700" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Field Marketers</h1>
                    <p className="text-slate-500">View performance footprint across active marketers.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                        <TableRow>
                            <TableHead className="py-4 text-slate-600">Marketer Name</TableHead>
                            <TableHead className="py-4 text-slate-600">Account ID</TableHead>
                            <TableHead className="py-4 text-slate-600">Total Recruited Members</TableHead>
                            <TableHead className="py-4 text-slate-600">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {marketers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                    No marketers found in the system.
                                </TableCell>
                            </TableRow>
                        ) : (
                            marketers.map((m) => (
                                <TableRow key={m.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <TableCell className="font-semibold text-slate-800">
                                        {m.staff?.[0]?.full_name || "Unknown Marketer"}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-500 max-w-[150px] truncate" title={m.user_id}>
                                        {m.user_id.split('-').pop()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold px-3 py-1">
                                            {m.total_members} Members
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {m.staff?.[0]?.is_active !== false ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-0 shadow-none">Active</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 shadow-none">Inactive</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
