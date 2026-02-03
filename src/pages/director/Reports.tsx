import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, FileText, Users, Stethoscope, DollarSign, CalendarDays } from "lucide-react";
import { format, getMonth, getYear, subMonths } from "date-fns";

interface ServiceUsage {
    service_name: string;
    count: number;
    total_benefit_cost: number;
}

interface MemberActivity {
    member_name: string;
    member_number: string;
    total_visits: number;
    total_deducted: number;
}

export default function DirectorReports() {
    const [loading, setLoading] = useState(true);
    const [serviceUsage, setServiceUsage] = useState<ServiceUsage[]>([]);
    const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);
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
            fetchReportsData(directorBranchId, currentMonth, currentYear);
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

    const fetchReportsData = async (branchId: string, month: number, year: number) => {
        setLoading(true);
        const startOfMonthDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
        const endOfMonthDate = format(new Date(year, month, 0), "yyyy-MM-dd");

        // Fetch service usage
        const { data: serviceData, error: serviceError } = await supabase
            .from("visits")
            .select("bills(bill_items(service_name, benefit_cost))")
            .eq("branch_id", branchId)
            .eq("status", "completed")
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        if (serviceError) {
            toast({ title: "Error fetching service usage", description: serviceError.message, variant: "destructive" });
            setServiceUsage([]);
        } else {
            const usageMap: Record<string, ServiceUsage> = {};
            (serviceData || []).forEach(visit => {
                visit.bills?.[0]?.bill_items?.forEach((item: any) => {
                    if (!usageMap[item.service_name]) {
                        usageMap[item.service_name] = { service_name: item.service_name, count: 0, total_benefit_cost: 0 };
                    }
                    usageMap[item.service_name].count += 1;
                    usageMap[item.service_name].total_benefit_cost += Number(item.benefit_cost);
                });
            });
            setServiceUsage(Object.values(usageMap).sort((a, b) => b.count - a.count));
        }

        // Fetch member activity
        const { data: memberData, error: memberError } = await supabase
            .from("visits")
            .select("member_id, members(full_name, member_number), bills(total_benefit_cost)")
            .eq("branch_id", branchId)
            .eq("status", "completed")
            .gte("created_at", startOfMonthDate)
            .lte("created_at", endOfMonthDate);

        if (memberError) {
            toast({ title: "Error fetching member activity", description: memberError.message, variant: "destructive" });
            setMemberActivity([]);
        } else {
            const activityMap: Record<string, MemberActivity> = {};
            (memberData || []).forEach(visit => {
                const memberId = visit.member_id;
                const memberName = visit.members?.full_name || "Unknown Member";
                const memberNumber = visit.members?.member_number || "N/A";
                const bill = visit.bills?.[0];

                if (!activityMap[memberId]) {
                    activityMap[memberId] = { member_name: memberName, member_number: memberNumber, total_visits: 0, total_deducted: 0 };
                }
                activityMap[memberId].total_visits += 1;
                activityMap[memberId].total_deducted += Number(bill?.total_benefit_cost || 0);
            });
            setMemberActivity(Object.values(activityMap).sort((a, b) => b.total_visits - a.total_visits));
        }

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
                    <h1 className="text-3xl font-bold tracking-tight">Branch Reports</h1>
                    <p className="text-muted-foreground">Detailed operational and financial reports for your branch.</p>
                </div>
            </div>

            <Card className="shadow-sm border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Report Period</CardTitle>
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
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <Card className="border-l-4 border-l-purple-600">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Stethoscope className="h-5 w-5" /> Top Services Used
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {serviceUsage.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-4">No service usage data.</p>
                            ) : (
                                <div className="space-y-3">
                                    {serviceUsage.map((service, index) => (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <span className="font-medium">{service.service_name}</span>
                                            <span className="text-muted-foreground">{service.count} visits (KES {service.total_benefit_cost.toLocaleString()})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-blue-600">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="h-5 w-5" /> Most Active Members
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {memberActivity.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-4">No member activity data.</p>
                            ) : (
                                <div className="space-y-3">
                                    {memberActivity.map((member, index) => (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <span className="font-medium">{member.member_name}</span>
                                            <span className="text-muted-foreground">{member.total_visits} visits (KES {member.total_deducted.toLocaleString()})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    );
}