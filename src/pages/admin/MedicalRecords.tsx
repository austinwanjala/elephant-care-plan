import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ZoomIn, Calendar, User, UserCheck, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PatientXray {
    id: string;
    image_url: string;
    uploaded_at: string;
    member_id: string;
    doctor_id: string;
    visit_id: string;
    members: { full_name: string, member_number: string } | null;
    doctor: { full_name: string } | null;
}

export default function AdminMedicalRecords() {
    const [xrays, setXrays] = useState<PatientXray[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedXray, setSelectedXray] = useState<PatientXray | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchXrays();
    }, []);

    const fetchXrays = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("patient_xrays")
                .select(`
                    *,
                    members(full_name, member_number),
                    doctor:doctor_id(full_name)
                `)
                .order("uploaded_at", { ascending: false });

            if (error) throw error;
            setXrays(data || []);
        } catch (error: any) {
            toast({ title: "Error fetching X-rays", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const filteredXrays = xrays.filter(x =>
        x.members?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        x.members?.member_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Medical Records (X-Rays)</h1>
                    <p className="text-muted-foreground">Browse and manage patient radiographic images.</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search patient name or #..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 shadow-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl border border-dashed">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground font-medium">Loading medical records...</p>
                </div>
            ) : filteredXrays.length === 0 ? (
                <Card className="border-dashed shadow-none bg-slate-50/50">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Search className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No records found</h3>
                        <p className="text-slate-500 max-w-xs">We couldn't find any X-ray images matching your search criteria.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredXrays.map((xray) => (
                        <Card key={xray.id} className="overflow-hidden group hover:ring-2 ring-primary transition-all cursor-pointer shadow-sm" onClick={() => setSelectedXray(xray)}>
                            <div className="aspect-square relative bg-slate-100">
                                <img
                                    src={xray.image_url}
                                    alt={`X-ray for ${xray.members?.full_name}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                    <ZoomIn className="text-white opacity-0 group-hover:opacity-100 h-8 w-8 drop-shadow-lg" />
                                </div>
                                <div className="absolute bottom-2 left-2 right-2">
                                    <Badge className="bg-white/90 text-slate-900 hover:bg-white text-[10px] backdrop-blur-sm">
                                        {format(new Date(xray.uploaded_at), "MMM d, yyyy")}
                                    </Badge>
                                </div>
                            </div>
                            <CardContent className="p-3">
                                <p className="font-bold text-sm truncate" title={xray.members?.full_name}>
                                    {xray.members?.full_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                    {xray.members?.member_number}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!selectedXray} onOpenChange={(open) => !open && setSelectedXray(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0">
                    <DialogHeader className="sr-only"><DialogTitle>X-Ray Detail</DialogTitle></DialogHeader>
                    {selectedXray && (
                        <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                            <div className="flex-1 bg-black flex items-center justify-center p-4">
                                <img
                                    src={selectedXray.image_url}
                                    alt="Full View"
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                            <div className="w-full md:w-72 bg-white p-6 space-y-6 overflow-y-auto">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold">Image Details</h3>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Patient Information</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1"><User className="h-4 w-4 text-primary" /></div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Patient Name</p>
                                            <p className="text-sm font-bold">{selectedXray.members?.full_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1"><UserCheck className="h-4 w-4 text-primary" /></div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Member Number</p>
                                            <p className="text-sm font-mono font-bold">{selectedXray.members?.member_number}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1"><Stethoscope className="h-4 w-4 text-primary" /></div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Referring Doctor</p>
                                            <p className="text-sm font-bold">{selectedXray.doctor?.full_name || "N/A"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1"><Calendar className="h-4 w-4 text-primary" /></div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Upload Date</p>
                                            <p className="text-sm font-bold">{format(new Date(selectedXray.uploaded_at), "PPPP")}</p>
                                            <p className="text-[10px] text-muted-foreground">{format(new Date(selectedXray.uploaded_at), "p")}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t">
                                    <a
                                        href={selectedXray.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 transition-colors"
                                    >
                                        Download Full Resolution
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
