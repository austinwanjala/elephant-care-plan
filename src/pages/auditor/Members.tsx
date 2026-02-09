import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/utils/csvExport";
import { format } from "date-fns";

const PAGE_SIZE = 10;

export default function AuditorMembers() {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchMembers = async () => {
        setLoading(true);
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
            .from("members")
            .select("*, membership_categories(name)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,member_number.ilike.%${searchTerm}%`);
        }

        const { data, count, error } = await query;
        if (data) setMembers(data);
        if (count !== null) setTotalCount(count);
        setLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMembers();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, currentPage]);

    const handleExport = () => {
        const dataToExport = members.map(m => ({
            "Member Number": m.member_number,
            "Full Name": m.full_name,
            "Phone": m.phone,
            "Category": m.membership_categories?.name || "N/A",
            "Status": m.is_active ? "Active" : "Inactive",
            "Joined Date": format(new Date(m.created_at), "yyyy-MM-dd")
        }));
        exportToCsv("members_audit_report.csv", dataToExport);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Members</h1>
                    <p className="text-muted-foreground">Read-only view of all registered members</p>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={loading}>
                    <Download className="mr-2 h-4 w-4" /> Export Report
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search members..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member #</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date Added</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : members.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-24">No members found.</TableCell></TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-mono">{member.member_number}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{member.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{member.phone}</div>
                                        </TableCell>
                                        <TableCell>{member.membership_categories?.name || "N/A"}</TableCell>
                                        <TableCell><Badge variant={member.is_active ? "default" : "destructive"}>{member.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                                        <TableCell>{format(new Date(member.created_at), "MMM d, yyyy")}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                        <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}