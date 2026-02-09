import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

export default function AuditorVisits() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchVisits = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("visits")
            .select("*, members(full_name), branches(name)")
            .order("created_at", { ascending: false })
            .limit(50); // Pagination in v2

        if (data) setVisits(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchVisits();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Visits</h1>
                <p className="text-muted-foreground">Read-only view of patient visits</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Visits</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Patient / Member</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Financials</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : visits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        No visits recorded.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visits.map((visit) => (
                                    <TableRow key={visit.id}>
                                        <TableCell>
                                            {new Date(visit.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{visit.members?.full_name}</div>
                                            {visit.dependant_id && <Badge variant="outline" className="text-xs">Dependant Visit</Badge>}
                                        </TableCell>
                                        <TableCell>{visit.branches?.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="capitalize">
                                                {visit.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            <div>Deducted: {visit.benefit_deducted}</div>
                                            <div>Comp: {visit.branch_compensation}</div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
