import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Users, Stethoscope, TrendingUp, CalendarDays } from "lucide-react";
import { format, getMonth, getYear, subMonths } from "date-fns";

interface DoctorPerformance {
    doctor_id: string;
    doctor_name: string;
    total_visits: number;
    total_compensation_generated: number;
    total_profit_loss_generated: number;
}

export default function DirectorPerformance() {
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<DoctorPerformance[]>([]);
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()) + 1); // 1-indexed
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [directorBranchId, setDirectorBranchId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDirectorInfo();
    }, []);

    useEffect(() => {
        if (directorBranchId) {
            fetchPerformanceData(directorBranchId, currentMonth, currentYear);
        }
    }, [directorBranchId, currentMonth, currentYear]);

    const fetchDirectorInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData?.branch_id) {
            toast({ title: "Access Denied", description: "You are not assigned to a branch.", variant: "destructive" });
            navigate("/");
            return;
        }
        setDirectorBranchId(staffData.branch_id);
    };

    const fetchPerformanceData = async (branchId: string, month: number, year: number) => {
        setLoading(true);
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd");

        const { data: visitsData, error: visitsError } = await supabase
            .from("visits")
            .select("id, doctor_id, bills(total_branch_compensation, total_profit_loss)")
            .eq("branch_id", branchId)
            .eq("status", "completed")
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        if (visitsError) {
            toast({ title: "Error fetching performance data", description: visitsError.message, variant: "destructive" });
            setPerformanceData([]);
            setLoading(false);
            return;
        }

        // Fetch doctor names separately
        const doctorIds = [...new Set((visitsData || []).map(v => v.doctor_id).filter(Boolean))];
        const { data: staffData } = await supabase.from("staff").select("id, full_name").in("id", doctorIds);
        const doctorMap = new Map((staffData || []).map(s => [s.id, s.full_name]));

        const performanceMap: Record<string, DoctorPerformance> = {};

        (visitsData || []).forEach(visit => {
            const doctorId = visit.doctor_id;
            const doctorName = doctorMap.get(doctorId || '') || "Unknown Doctor";
            const bill = (visit.bills as any)?.[0];

            if (doctorId && bill) {
                if (!performanceMap[doctorId]) {
                    performanceMap[doctorId] = {
                        doctor_id: doctorId,
                        doctor_name: doctorName,
                        total_visits: 0,
                        total_compensation_generated: 0,
                        total_profit_loss_generated: 0,
                    };
                }
                performanceMap[doctorId].total_visits += 1;
                performanceMap[doctorId].total_compensation_generated += Number(bill.total_branch_compensation);
                performanceMap[doctorId].total_profit_loss_generated += Number(bill.total_profit_loss);
            }
        });

        setPerformanceData(Object.values(performanceMap));
        setLoading(false);
    };

    const getMonthOptions = () => {
        const options = [];
        let date = new Date();
        for (let i = 0; i < 12; i++) { // Last 12 months
            options.push(date);
            date = subMonths(date, 1);
        }
        return options.reverse();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/director">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Doctor Performance</h1>
                    <p className="text-muted-foreground">Overview of doctor activity and financial contributions.</p>
                </div>
            </div>

            <Card className="shadow-sm border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Performance Period</CardTitle>
                    <Select
                        value={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                        onValueChange={(value) => {
                            const [yearStr, monthStr] = value.split('-');
                            setCurrentYear(parseInt(yearStr));
                            setCurrentMonth(parseInt(monthStr));
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                            {getMonthOptions().map((date, index) => (
                                <SelectItem key={index} value={`${getYear(date)}-${(getMonth(date) + 1).toString().padStart(2, '0')}`}>
                                    {format(date, "MMM yyyy")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {performanceData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No doctor performance data for this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] divide-y divide-border">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground">
                                        <th className="py-3 pr-3 font-semibold">Doctor Name</th>
                                        <th className="py-3 px-3 font-semibold">Total Visits</th>
                                        <th className="py-3 px-3 font-semibold">Compensation Generated</th>
                                        <th className="py-3 pl-3 font-semibold text-right">Net Profit/Loss</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {performanceData.map(doc => (
                                        <tr key={doc.doctor_id} className="hover:bg-muted/50">
                                            <td className="py-3 pr-3 text-sm font-medium">{doc.doctor_name}</td>
                                            <td className="py-3 px-3 text-sm">{doc.total_visits}</td>
                                            <td className="py-3 px-3 text-sm text-blue-700">KES {doc.total_compensation_generated.toLocaleString()}</td>
                                            <td className={`py-3 pl-3 text-sm font-medium text-right ${doc.total_profit_loss_generated >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                KES {doc.total_profit_loss_generated.toLocaleString()}
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
    );
}