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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Users, Plus, Eye, Search } from "lucide-react";

export default function AdminMarketers() {
    const [marketers, setMarketers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedMarketer, setSelectedMarketer] = useState<any>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
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
                full_name: m.full_name,
                is_active: m.is_active,
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

    const filteredMarketers = marketers.filter(m => 
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.user_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && marketers.length === 0) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-sm">
                        <Users className="h-6 w-6 text-slate-700" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Partners (Marketers)</h1>
                        <p className="text-slate-500 text-sm">Central registry of all registered marketing partners across the network.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search partners..." 
                            className="pl-9 h-10 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-slate-900 hover:bg-slate-800 shadow-sm rounded-xl h-10">
                                <Plus className="h-4 w-4 mr-2" /> New Partner
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Register New Marketing Partner</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Full Name / Corporate Entity</Label>
                                    <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="Jane Doe" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="partner@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Primary Phone</Label>
                                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0712 345 678" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Temporary Password</Label>
                                    <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" />
                                </div>
                                <Button className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl" onClick={handleCreateMarketer} disabled={createLoading}>
                                    {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Onboard Partner
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                        <TableRow>
                            <TableHead className="py-4 text-slate-800 font-bold uppercase text-[10px] tracking-widest pl-6">Partner Name</TableHead>
                            <TableHead className="py-4 text-slate-800 font-bold uppercase text-[10px] tracking-widest text-center">Recruitment Stats</TableHead>
                            <TableHead className="py-4 text-slate-800 font-bold uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                            <TableHead className="py-4 text-slate-800 font-bold uppercase text-[10px] tracking-widest text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMarketers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-20 text-slate-400">
                                    No marketing partners found matching your search.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredMarketers.map((m) => (
                                <TableRow key={m.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                    <TableCell className="pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                                                {m.full_name?.charAt(0) || "P"}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{m.full_name || "Unknown Partner"}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {m.user_id.split('-').pop()}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-black px-3 py-1">
                                            {m.total_members} Members Recruited
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {m.is_active !== false ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-0 shadow-none font-bold">Active</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 shadow-none font-bold">Inactive</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                            onClick={() => {
                                                setSelectedMarketer(m);
                                                setProfileOpen(true);
                                            }}
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> Details
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
                <DialogContent className="max-w-md rounded-2xl">
                    {selectedMarketer && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-slate-900/20">
                                        {selectedMarketer.full_name?.charAt(0) || "P"}
                                    </div>
                                    <div>
                                        <DialogTitle className="text-2xl font-black">{selectedMarketer.full_name}</DialogTitle>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{selectedMarketer.user_id.split('-')[0]} Category</Badge>
                                            <Badge className={selectedMarketer.is_active !== false ? "bg-emerald-100 text-emerald-800 border-0 font-bold" : "bg-slate-100 text-slate-600 border-0 font-bold"}>
                                                {selectedMarketer.is_active !== false ? 'Active Status' : 'Deactivated'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="py-6 space-y-6">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center shadow-inner">
                                        <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-widest">Total Network Inflow</p>
                                        <p className="text-4xl font-black text-slate-900">{selectedMarketer.total_members}<span className="text-sm font-medium text-slate-400 ml-2">Memberships</span></p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest px-1">Engagement History</p>
                                    <div className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-600">Verification Rate</span>
                                        <Badge className="bg-blue-600 text-white font-black">100%</Badge>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
