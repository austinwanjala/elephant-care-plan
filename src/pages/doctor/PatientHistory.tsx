import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, User, History, Loader2, ArrowLeft, Stethoscope, FileText, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { DentalChart, DentalChartMode } from "@/components/doctor/DentalChart";
import { format } from "date-fns";

export default function DoctorPatientHistory() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [visits, setVisits] = useState<any[]>([]);
    const [dentalRecords, setDentalRecords] = useState<Record<number, string>>({});
    const { toast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm) return;
        setSearching(true);
        setMember(null);
        setVisits([]);
        setDentalRecords({});

        try {
            const { data, error } = await supabase
                .from("members")
                .select("*, membership_categories(name), branches(name)")
                .or(`phone.ilike."%${searchTerm}%",id_number.ilike."%${searchTerm}%",member_number.ilike."%${searchTerm}%",full_name.ilike."%${searchTerm}%"`)
                .maybeSingle();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error("Multiple members found. Please be more specific.");
                }
                throw error;
            }

            if (data) {
                setMember(data);
                fetchMemberHistory(data.id);
            } else {
                toast({ title: "Member not found", description: "No member found matching that criteria.", variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Search failed", description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const fetchMemberHistory = async (memberId: string) => {
        // Fetch visits
        const { data: visitsData, error: visitsError } = await supabase
            .from("visits")
            .select("*, branches(name), doctor:doctor_id(full_name), bills(total_benefit_cost, bill_items(service_name))")
            .eq("member_id", memberId)
            .eq("status", "completed") // Only show completed visits
            .order("created_at", { ascending: false });

        if (visitsError) {
            toast({ title: "Error fetching visits", description: visitsError.message, variant: "destructive" });
        } else {
            setVisits(visitsData || []);
        }

        // Fetch dental records
        const { data: dentalRecordsData, error: dentalRecordsError } = await supabase
            .from("dental_records")
            .select("tooth_number, status")
            .eq("member_id", memberId);

        if (dentalRecordsError) {
            toast({ title: "Error fetching dental records", description: dentalRecordsError.message, variant: "destructive" });
        } else {
            const recordsMap: Record<number, string> = {};
            (dentalRecordsData || []).forEach(record => {
                recordsMap[record.tooth_number] = record.status;
            });
            setDentalRecords(recordsMap);
        }
    };

    const calculateAge = (dob: string) => {
        if (!dob) return 0;
        const diffMs = Date.now() - new Date(dob).getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    };

    let chartMode: DentalChartMode = 'adult';
    if (member?.dob) {
        const age = calculateAge(member.dob);
        if (age < 6) chartMode = 'child';
        else if (age < 13) chartMode = 'mixed';
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/doctor">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Patient History</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Patient Lookup</CardTitle>
                    <CardDescription>Enter Phone Number, National ID, or Member Number to view patient history.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <Input
                            placeholder="Phone, ID, or Member Number"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="submit" disabled={searching}>
                            {searching ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Search</span>
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {member && (
                <div className="space-y-6">
                    <Card className="border-primary/50">
                        <CardHeader className="bg-primary/5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{member.full_name}</CardTitle>
                                    <CardDescription>Member #{member.member_number}</CardDescription>
                                </div>
                                <Badge variant={member.is_active ? "default" : "destructive"}>
                                    {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <Label className="text-muted-foreground">Phone</Label>
                                <p className="font-medium">{member.phone}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">ID Number</Label>
                                <p className="font-medium">{member.id_number}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Coverage Balance</Label>
                                <p className="font-medium text-primary">KES {member.coverage_balance?.toLocaleString()}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Membership</Label>
                                <p className="font-medium">{member.membership_categories?.name || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Stethoscope className="h-5 w-5" /> Dental Chart History
                            </CardTitle>
                            <CardDescription>Current and historical dental records for {member.full_name}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DentalChart
                                onToothClick={() => { }} // Not interactive in history view
                                selectedTeeth={[]}
                                toothStatus={dentalRecords}
                                mode={chartMode}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" /> Visit History
                            </CardTitle>
                            <CardDescription>Past completed visits and services provided.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {visits.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No past visits found for this member.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[600px] divide-y divide-border">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground">
                                                <th className="py-3 pr-3 font-semibold">Date</th>
                                                <th className="py-3 px-3 font-semibold">Doctor</th>
                                                <th className="py-3 px-3 font-semibold">Branch</th>
                                                <th className="py-3 px-3 font-semibold">Services</th>
                                                <th className="py-3 pl-3 font-semibold text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {visits.map(visit => (
                                                <tr key={visit.id} className="hover:bg-muted/50">
                                                    <td className="py-3 pr-3 text-sm">{format(new Date(visit.created_at), 'MMM d, yyyy')}</td>
                                                    <td className="py-3 px-3 text-sm">{visit.doctor?.full_name || 'N/A'}</td>
                                                    <td className="py-3 px-3 text-sm">{visit.branches?.name || 'N/A'}</td>
                                                    <td className="py-3 px-3 text-sm max-w-[200px] truncate">
                                                        {visit.bills?.[0]?.bill_items?.map((item: any) => item.service_name).join(", ") || 'N/A'}
                                                    </td>
                                                    <td className="py-3 pl-3 text-sm font-medium text-right text-destructive">
                                                        -KES {Number(visit.bills?.[0]?.total_benefit_cost || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}