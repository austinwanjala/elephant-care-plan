import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DAYS = [
    { id: 1, name: "Monday" },
    { id: 2, name: "Tuesday" },
    { id: 3, name: "Wednesday" },
    { id: 4, name: "Thursday" },
    { id: 5, name: "Friday" },
    { id: 6, name: "Saturday" },
    { id: 0, name: "Sunday" },
];

interface Schedule {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

const DoctorScheduleManager = () => {
    const queryClient = useQueryClient();
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
    const [schedules, setSchedules] = useState<Schedule[]>([]);

    // Fetch branches
    const { data: branches } = useQuery({
        queryKey: ["branches"],
        queryFn: async () => {
            const { data, error } = await supabase.from("branches").select("*").order("name");
            if (error) throw error;
            return data;
        },
    });

    // Fetch doctors for selected branch
    const { data: doctors } = useQuery({
        queryKey: ["doctors", selectedBranchId],
        enabled: !!selectedBranchId,
        queryFn: async () => {
            // Fetch staff with doctor role
            const { data: roleData, error: roleError } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "doctor");

            if (roleError) throw roleError;

            const doctorIds = roleData.map(r => r.user_id);

            if (doctorIds.length === 0) return [];

            const { data, error } = await supabase
                .from("staff")
                .select("id, full_name")
                .eq("branch_id", selectedBranchId)
                .in("user_id", doctorIds);

            if (error) throw error;
            return data;
        },
    });

    // Fetch schedules for selected doctor
    const { data: fetchedSchedules, isLoading: isLoadingSchedules } = useQuery({
        queryKey: ["doctor_schedules", selectedDoctorId],
        enabled: !!selectedDoctorId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("doctor_schedules")
                .select("*")
                .eq("doctor_id", selectedDoctorId)
                .eq("branch_id", selectedBranchId);

            if (error) throw error;
            return data;
        },
    });

    // Initialize state with fetched schedules or defaults
    useEffect(() => {
        if (selectedDoctorId && fetchedSchedules) {
            const newSchedules = DAYS.map(day => {
                const existing = fetchedSchedules.find(s => s.day_of_week === day.id);
                return existing ? {
                    day_of_week: existing.day_of_week,
                    start_time: existing.start_time.slice(0, 5),
                    end_time: existing.end_time.slice(0, 5),
                    is_active: existing.is_active
                } : {
                    day_of_week: day.id,
                    start_time: "09:00",
                    end_time: "17:00",
                    is_active: false
                };
            });
            setSchedules(newSchedules);
        }
    }, [fetchedSchedules, selectedDoctorId]);

    const saveMutation = useMutation({
        mutationFn: async (updatedSchedules: Schedule[]) => {
            // Delete existing for this doctor/branch to avoid complex upsert logic with minimal rows
            const { error: deleteError } = await supabase
                .from("doctor_schedules")
                .delete()
                .eq("doctor_id", selectedDoctorId)
                .eq("branch_id", selectedBranchId);

            if (deleteError) throw deleteError;

            // Insert active ones
            const toInsert = updatedSchedules.map(s => ({
                doctor_id: selectedDoctorId,
                branch_id: selectedBranchId,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                is_active: s.is_active
            }));

            const { error: insertError } = await supabase
                .from("doctor_schedules")
                .insert(toInsert);

            if (insertError) throw insertError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["doctor_schedules", selectedDoctorId] });
            toast.success("Schedule updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update schedule: " + error.message);
        }
    });

    const handleScheduleChange = (dayId: number, field: keyof Schedule, value: any) => {
        setSchedules(prev => prev.map(s =>
            s.day_of_week === dayId ? { ...s, [field]: value } : s
        ));
    };

    const handleSave = () => {
        if (!selectedDoctorId || !selectedBranchId) return;
        saveMutation.mutate(schedules);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Select Branch</Label>
                    <Select value={selectedBranchId || ""} onValueChange={setSelectedBranchId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a branch" />
                        </SelectTrigger>
                        <SelectContent>
                            {branches?.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Select Doctor</Label>
                    <Select
                        value={selectedDoctorId || ""}
                        onValueChange={setSelectedDoctorId}
                        disabled={!selectedBranchId}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a doctor" />
                        </SelectTrigger>
                        <SelectContent>
                            {doctors?.map(d => (
                                <SelectItem key={d.id} value={d.id}>Dr. {d.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedDoctorId && (
                <Card>
                    <CardContent className="pt-6">
                        {isLoadingSchedules ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : (
                            <div className="space-y-4">
                                {schedules.map((schedule) => (
                                    <div key={schedule.day_of_week} className="flex items-center gap-4 p-3 border rounded-md">
                                        <div className="w-24 font-medium">
                                            {DAYS.find(d => d.id === schedule.day_of_week)?.name}
                                        </div>

                                        <Switch
                                            checked={schedule.is_active}
                                            onCheckedChange={(c) => handleScheduleChange(schedule.day_of_week, "is_active", c)}
                                        />

                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="time"
                                                value={schedule.start_time}
                                                disabled={!schedule.is_active}
                                                onChange={(e) => handleScheduleChange(schedule.day_of_week, "start_time", e.target.value)}
                                                className="w-32"
                                            />
                                            <span>to</span>
                                            <Input
                                                type="time"
                                                value={schedule.end_time}
                                                disabled={!schedule.is_active}
                                                onChange={(e) => handleScheduleChange(schedule.day_of_week, "end_time", e.target.value)}
                                                className="w-32"
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSave} disabled={saveMutation.isPending}>
                                        {saveMutation.isPending ? "Saving..." : "Save Schedule"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default DoctorScheduleManager;
