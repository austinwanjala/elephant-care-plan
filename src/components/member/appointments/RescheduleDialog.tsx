import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // Assuming standard UI calendar
import { format, addMinutes } from "date-fns";
import { Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface RescheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointment: any; // Type properly if possible
}

export function RescheduleDialog({ open, onOpenChange, appointment }: RescheduleDialogProps) {
    const queryClient = useQueryClient();
    const [date, setDate] = useState<Date | undefined>(new Date(appointment?.appointment_date || new Date()));
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    // Fetch Slots logic (copied/adapted from BookingWizard)
    const { data: slots, isLoading: isLoadingSlots } = useQuery({
        queryKey: ["slots", appointment?.doctor_id, date],
        enabled: !!appointment?.doctor_id && !!date && open,
        queryFn: async () => {
            const formattedDate = format(date!, "yyyy-MM-dd");
            const { data, error } = await supabase.rpc("get_doctor_availability" as any, {
                p_doctor_id: appointment.doctor_id,
                p_date: formattedDate
            });
            if (error) throw error;
            return data as unknown as string[];
        },
    });

    const rescheduleMutation = useMutation({
        mutationFn: async () => {
            if (!date || !selectedSlot) return;

            // Calculate end time (assuming 30 mins or fetch from doctor settings? For now 30)
            // Better: fetch slot_duration from settings. But we can default to 30.
            const [hours, minutes] = selectedSlot.split(':').map(Number);
            const startTime = selectedSlot;
            // Simple calculation for end time string
            const startDate = new Date(date);
            startDate.setHours(hours, minutes, 0);
            const endDate = addMinutes(startDate, 30);
            const endTime = format(endDate, "HH:mm:ss");

            const { error } = await supabase
                .from("appointments")
                .update({
                    appointment_date: format(date, "yyyy-MM-dd"),
                    start_time: startTime,
                    end_time: endTime,
                    status: 'pending', // Reset to pending if rescheduled?
                    updated_at: new Date().toISOString()
                })
                .eq("id", appointment.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["member_appointments"] });
            toast.success("Appointment rescheduled successfully");
            onOpenChange(false);
        },
        onError: (err) => {
            toast.error("Failed to reschedule: " + err.message);
        }
    });

    if (!appointment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Reschedule Appointment</DialogTitle>
                    <DialogDescription>
                        Select a new date and time for your appointment with Dr. {appointment.doctor?.full_name}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex justify-center">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            disabled={(date) => date < new Date() || date.getDay() === 0} // Disable past & Sundays (naive)
                            className="rounded-md border"
                        />
                    </div>

                    {date && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Available Slots on {format(date, "MMM do")}
                            </h4>
                            <ScrollArea className="h-[120px] rounded-md border p-2">
                                {isLoadingSlots ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin h-4 w-4" /></div>
                                ) : !slots || slots.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center p-2">No slots available.</p>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2">
                                        {slots.map((slot) => (
                                            <Button
                                                key={slot}
                                                variant={selectedSlot === slot ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setSelectedSlot(slot)}
                                                className="w-full text-xs"
                                            >
                                                {slot.slice(0, 5)}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={() => rescheduleMutation.mutate()}
                        disabled={!date || !selectedSlot || rescheduleMutation.isPending}
                    >
                        {rescheduleMutation.isPending ? "Confirming..." : "Confirm Reschedule"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
