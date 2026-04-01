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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Users, Plus, Eye, Mail, Phone, Calendar } from "lucide-react";

export default function SuperAgentMarketers() {
    const [marketers, setMarketers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedMarketer, setSelectedMarketer] = useState<any>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [marketerMembers, setMarketerMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        password: ""
    });
    const { toast } = useToast();

    useEffect(() => {
        loadMarketers();
    }, []);

    useEffect(() => {
        if (selectedMarketer?.id && profileOpen) {
            loadMarketerMembers(selectedMarketer.id);
        } else {
            setMarketerMembers([]);
        }
    }, [selectedMarketer, profileOpen]);

    const loadMarketerMembers = async (marketerId: string) => {
        setLoadingMembers(true);
        try {
            const { data, error } = await supabase
                .from("members")
                .select("id, full_name, created_at, is_active, member_number")
                .eq("marketer_id", marketerId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setMarketerMembers(data || []);
        } catch (error: any) {
            console.error("Error loading marketer members:", error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const loadMarketers = async () => {
        setLoading(true);
        try {
            // Use RPC to bypass row-level-security gracefully and fetch pre-counted active field agents.
            const { data, error } = await supabase.rpc("super_agent_get_marketers");

            if (error) throw error;

            // Map the RPC row names to match the component format
            const mappedData = (data || []).map((m: any) => ({
                id: m.id || m.user_id,
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

    const handleCreateMarketer = async () => {
        if (!formData.fullName || !formData.email || !formData.password) {
            toast({ title: "Incomplete", description: "Name, email, and password are required.", variant: "destructive" });
            return;
        }

        setCreateLoading(true);
        try {
            const { error } = await supabase.functions.invoke("admin-create-user", {
                body: {
                    email: formData.email,
                    password: formData.password,
                    metadata: {
                        role: "marketer",
                        full_name: formData.fullName,
                        phone: formData.phone || null,
                        id_number: `MKT-${Date.now()}`,
                        age: 30
                    }
                }
            });

            if (error) {
                const errorData = await error.context?.json().catch(() => ({}));
                throw new Error(errorData?.error || error.message);
            }

            toast({ title: "Marketer Created", description: "They can now log into the marketer portal." });
            setCreateOpen(false);
            setFormData({ fullName: "", email: "", phone: "", password: "" });
            loadMarketers();
        } catch (error: any) {
            toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
        } finally {
            setCreateLoading(false);
        }
    };

    if (loading && marketers.length === 0) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-3 rounded-xl border border-indigo-200 shadow-sm">
                        <Users className="h-6 w-6 text-indigo-700" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Field Marketers</h1>
                        <p className="text-slate-500">View performance footprint across active marketers.</p>
                    </div>
                </div>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200">
                            <Plus className="h-4 w-4 mr-2" /> Add Marketer
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Field Marketer</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="Jane Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="jane@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0712 345 678" />
                            </div>
                            <div className="space-y-2">
                                <Label>Temporary Password</Label>
                                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" />
                            </div>
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleCreateMarketer} disabled={createLoading}>
                                {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Create Marketer
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                        <TableRow>
                            <TableHead className="py-4 text-slate-600">Marketer Name</TableHead>
                            <TableHead className="py-4 text-slate-600">Account ID</TableHead>
                            <TableHead className="py-4 text-slate-600">Total Recruited Members</TableHead>
                            <TableHead className="py-4 text-slate-600">Status</TableHead>
                            <TableHead className="py-4 text-slate-600 w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {marketers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                            onClick={() => {
                                                setSelectedMarketer(m);
                                                setProfileOpen(true);
                                            }}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Profile Dialog */}
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                <DialogContent className="max-w-md">
                    {selectedMarketer && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl">
                                        {selectedMarketer.staff?.[0]?.full_name?.charAt(0) || "M"}
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl">{selectedMarketer.staff?.[0]?.full_name || "Unknown Marketer"}</DialogTitle>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs font-mono">{selectedMarketer.user_id.split('-')[0]}</Badge>
                                            <Badge className={selectedMarketer.staff?.[0]?.is_active !== false ? "bg-emerald-100 text-emerald-800 border-0" : "bg-slate-100 text-slate-600 border-0"}>
                                                {selectedMarketer.staff?.[0]?.is_active !== false ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="py-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-center">
                                        <p className="text-xs text-indigo-500 font-semibold mb-1 uppercase tracking-wider">Generated Members</p>
                                        <p className="text-3xl font-black text-indigo-900">{selectedMarketer.total_members}</p>
                                    </div>
                                </div>

                                <div className="mt-6 border-t pt-4">
                                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Users className="h-4 w-4 text-indigo-600" /> Referred Members
                                    </h3>
                                    
                                    {loadingMembers ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                                        </div>
                                    ) : marketerMembers.length === 0 ? (
                                        <div className="text-center py-6 text-slate-500 text-sm bg-slate-50 rounded-lg border border-slate-100">
                                            No members recruited yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                            {marketerMembers.map((member) => (
                                                <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-100 transition-colors">
                                                    <div>
                                                        <p className="font-semibold text-sm text-slate-900">{member.full_name}</p>
                                                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                            <span>#{member.member_number}</span>
                                                            <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                                            <span>{new Date(member.created_at).toLocaleDateString()}</span>
                                                        </p>
                                                    </div>
                                                    <Badge variant={member.is_active ? "default" : "secondary"} className={member.is_active ? "bg-emerald-100 text-emerald-800 border-0 shadow-none hover:bg-emerald-100" : "bg-slate-100 text-slate-600 border-0 shadow-none hover:bg-slate-100"}>
                                                        {member.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
