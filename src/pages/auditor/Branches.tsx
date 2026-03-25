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
import { Loader2, Building2, AlertTriangle, PlayCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AuditorBranches() {
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { toast } = useToast();

    // Fine dialog state
    const [fineDialogOpen, setFineDialogOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<any>(null);
    const [warningLevel, setWarningLevel] = useState<number>(1);
    const [fineAmount, setFineAmount] = useState<string>("");
    const [reason, setReason] = useState<string>("");

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("branches")
            .select(`
                *,
                branch_fines(
                    id, amount, warning_level, reason, status
                )
            `)
            .order("created_at", { ascending: false });

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setBranches(data || []);
        }
        setLoading(false);
    };

    const handleIssueFine = async () => {
        if (!selectedBranch || !fineAmount || !reason) {
            toast({ title: "Validation Error", description: "Please fill all fields.", variant: "destructive" });
            return;
        }

        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: staff } = await supabase.from("staff").select("id").eq("user_id", user?.id).single();

            // 1. Create the Fine entry
            const { error: fineError } = await supabase.from("branch_fines").insert({
                branch_id: selectedBranch.id,
                auditor_id: staff?.id,
                amount: parseFloat(fineAmount),
                reason,
                warning_level: warningLevel
            });

            if (fineError) throw fineError;

            // 2. Determine new status
            let newStatus = selectedBranch.status || 'active';
            let updateActive = selectedBranch.is_active;

            if (warningLevel === 2) {
                newStatus = 'suspended';
                updateActive = false;
            } else if (warningLevel === 3) {
                newStatus = 'terminated';
                updateActive = false;
            }

            // 3. Update branch status
            if (newStatus !== selectedBranch.status || warningLevel > 1) {
                const { error: updateError } = await supabase
                    .from("branches")
                    .update({ status: newStatus, is_active: updateActive })
                    .eq("id", selectedBranch.id);

                if (updateError) throw updateError;
            }

            toast({ title: "Sanction Applied", description: `Branch has been fined and set to ${newStatus}.` });
            setFineDialogOpen(false);
            loadBranches();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRestoreBranch = async (branchId: string) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("branches")
                .update({ status: 'active', is_active: true })
                .eq("id", branchId);

            if (error) throw error;
            toast({ title: "Branch Restored", description: "The branch is now active again." });
            loadBranches();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const openFineDialog = (branch: any, level: number) => {
        setSelectedBranch(branch);
        setWarningLevel(level);
        setFineAmount("");
        setReason("");
        setFineDialogOpen(true);
    };

    const getStatusBadge = (status: string) => {
        if (!status) status = 'active'; // Default
        switch (status.toLowerCase()) {
            case "active": return <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>;
            case "suspended": return <Badge className="bg-amber-100 text-amber-800">Suspended</Badge>;
            case "terminated": return <Badge className="bg-rose-100 text-rose-800">Terminated</Badge>;
            default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative w-full h-48 md:h-64 rounded-3xl overflow-hidden mb-6 shadow-xl group">
                <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80" alt="Branches" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent flex flex-col justify-center px-8 md:px-12 backdrop-blur-[2px]">
                    <h1 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tight leading-tight drop-shadow-xl">Branch Audits & Compliance.</h1>
                    <p className="text-emerald-400 mt-2 font-black tracking-widest uppercase text-xs md:text-sm drop-shadow-md">Monitor and penalize non-compliance</p>
                </div>
            </div>

            <div className="card-elevated overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch Name</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Total Fines</TableHead>
                                <TableHead className="text-right">Sanctions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {branches.map((branch) => {
                                const finesTotal = branch.branch_fines?.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0) || 0;
                                const maxWarningText = branch.branch_fines?.length > 0
                                    ? `Lvl ${Math.max(...branch.branch_fines.map((f: any) => f.warning_level))} Reached`
                                    : "No Fines";

                                return (
                                    <TableRow key={branch.id}>
                                        <TableCell className="font-medium">{branch.name}</TableCell>
                                        <TableCell>{branch.location}</TableCell>
                                        <TableCell>{getStatusBadge(branch.status || (branch.is_active ? 'active' : 'suspended'))}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-rose-600">KES {finesTotal.toLocaleString()}</span>
                                                <span className="text-xs text-muted-foreground">{maxWarningText}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {(branch.status === 'suspended' || branch.status === 'terminated') ? (
                                                     <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleRestoreBranch(branch.id)} disabled={actionLoading}>
                                                        <PlayCircle className="h-4 w-4 mr-1" />
                                                        Restore
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => openFineDialog(branch, 1)}>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            1st Warning
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => openFineDialog(branch, 2)}>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Suspend
                                                        </Button>
                                                        <Button size="sm" variant="destructive" onClick={() => openFineDialog(branch, 3)}>
                                                            Terminate
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={fineDialogOpen} onOpenChange={setFineDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Issue Sanction: {selectedBranch?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-semibold text-slate-900 mb-1">
                                Action: {warningLevel === 1 ? 'First Warning (Fine)' : warningLevel === 2 ? 'Second Warning (Suspension + Fine)' : 'Third Warning (Termination + Fine)'}
                            </h4>
                            <p className="text-sm text-slate-500">
                                This will apply a fine and update the branch's status accordingly. Branch directors will be notified.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Fine Amount (KES) *</Label>
                            <Input
                                type="number"
                                placeholder="Amount to charge..."
                                value={fineAmount}
                                onChange={(e) => setFineAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Reason / Infraction Details *</Label>
                            <Textarea
                                placeholder="Describe the non-compliance issue..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <Button variant="outline" onClick={() => setFineDialogOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleIssueFine} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Apply Sanction
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
