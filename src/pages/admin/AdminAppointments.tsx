import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Download, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface Appointment {
    id: string;
    appointment_date: string;
    start_time: string;
    status: string;
    notes: string | null;
    created_at: string;
    members: { full_name: string; member_number: string } | null;
    branches: { name: string } | null;
    doctor: { full_name: string } | null;
}

export default function AdminAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const { toast } = useToast();

    useEffect(() => {
        loadAppointments();
    }, [date]);

    const loadAppointments = async () => {
        setLoading(true);

        let query = (supabase as any)
            .from("appointments")
            .select(`
        *,
        members(full_name, member_number),
        branches(name),
        doctor:doctor_id(full_name)
      `)
            .order("appointment_date", { ascending: false })
            .order("start_time", { ascending: false });

        if (date?.from) {
            const fromDate = format(date.from, "yyyy-MM-dd");
            query = query.gte("appointment_date", fromDate);
        }
        if (date?.to) {
            const toDate = format(date.to, "yyyy-MM-dd");
            query = query.lte("appointment_date", toDate);
        }

        const { data, error } = await query;

        if (error) {
            toast({
                title: "Error loading appointments",
                description: error.message,
                variant: "destructive",
            });
        } else {
            setAppointments((data || []) as any);
        }
        setLoading(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
            case "confirmed":
                return <Badge className="bg-blue-600">Confirmed</Badge>;
            case "checked_in":
                return <Badge className="bg-purple-600">Checked In</Badge>;
            case "completed":
                return <Badge className="bg-green-600">Completed</Badge>;
            case "cancelled":
                return <Badge variant="destructive">Cancelled</Badge>;
            case "no_show":
                return <Badge variant="destructive" className="bg-red-800">No Show</Badge>;
            case "rescheduled":
                return <Badge variant="outline" className="text-orange-600 border-orange-200">Rescheduled</Badge>;
            case "rejected":
                return <Badge variant="destructive" className="bg-red-600">Rejected</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleExport = () => {
        const dataToExport = appointments.map(a => ({
            "Date": a.appointment_date,
            "Time": a.start_time,
            "Member Name": a.members?.full_name || "N/A",
            "Member Number": a.members?.member_number || "N/A",
            "Branch": a.branches?.name || "N/A",
            "Doctor": a.doctor?.full_name || "N/A",
            "Status": a.status,
            "Notes": a.notes || ""
        }));
        exportToCsv("appointments_export.csv", dataToExport);
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
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-foreground">Appointments</h1>
                    <p className="text-muted-foreground">Manage and view all appointments across branches</p>
                </div>
                <div className="flex gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-[300px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "LLL dd, y")} -{" "}
                                            {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Filter by Date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            <Card className="card-elevated overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        All Appointments
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Member</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Doctor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {appointments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        No appointments found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                appointments.map((apt) => (
                                    <TableRow key={apt.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{format(new Date(apt.appointment_date), "MMM d, yyyy")}</span>
                                                <span className="text-xs text-muted-foreground">{apt.start_time}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{apt.members?.full_name}</p>
                                                <p className="text-xs text-muted-foreground font-mono">
                                                    {apt.members?.member_number}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{apt.branches?.name || "N/A"}</TableCell>
                                        <TableCell>{apt.doctor?.full_name || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                                        <TableCell>{getStatusBadge(apt.status)}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={apt.notes || ""}>
                                            {apt.notes || "-"}
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
