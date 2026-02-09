import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

export default function AuditorMembers() {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchMembers = async () => {
        setLoading(true);
        let query = supabase
            .from("members")
            .select("*, membership_categories(name)")
            .order("created_at", { ascending: false });

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,member_number.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        if (data) setMembers(data);
        setLoading(false);
    };

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchMembers();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Members</h1>
                    <p className="text-muted-foreground">Read-only view of all registered members</p>
                </div>
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
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : members.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        No members found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-mono">{member.member_number}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{member.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{member.phone}</div>
                                        </TableCell>
                                        <TableCell>{member.membership_categories?.name || "N/A"}</TableCell>
                                        <TableCell>
                                            <Badge variant={member.is_active ? "default" : "destructive"}>
                                                {member.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(member.created_at).toLocaleDateString()}
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
