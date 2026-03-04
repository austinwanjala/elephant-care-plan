import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, User, MapPin, Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BookingWizardProps {
    onSuccess: () => void;
}

const STEPS = [
    { id: 1, title: "Patient" },
    { id: 2, title: "Branch" },
    { id: 3, title: "Doctor" },
    { id: 4, title: "Slot" },
    { id: 5, title: "Confirm" },
];

const BookingWizard = ({ onSuccess }: BookingWizardProps) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({
        memberId: "", // Principal Member ID
        patientId: "self", // 'self' or dependant_id
        isDependant: false,
        branchId: "",
        doctorId: "",
        date: new Date(),
        time: "",
        reason: "General Consultation" // Default for now
    });

    // --- Data Fetching ---

    // 1. Fetch Member & Dependants
    const { data: memberData, isLoading: isLoadingMember } = useQuery({
        queryKey: ["booking_member_data"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Get Principal Member
            const { data: member, error: memberError } = await supabase
                .from("members")
                .select("id, full_name")
                .eq("user_id", user.id)
                .single();

            if (memberError) throw memberError;

            // Get Dependants
            const { data: dependants, error: depError } = await supabase
                .from("dependants")
                .select("id, full_name") // Uses full_name as per schema
                .eq("member_id", member.id);

            if (depError) throw depError;

            return { member, dependants: dependants || [] };
        }
    });

    // 2. Fetch Branches
    const { data: branches, isLoading: isLoadingBranches } = useQuery({
        queryKey: ["branches"],
        queryFn: async () => {
            const { data, error } = await supabase.from("branches").select("id, name").order("name");
            if (error) throw error;
            return data;
        },
        enabled: step === 2
    });

    // 3. Fetch Doctors (filtered by Branch)
    const { data: doctors, isLoading: isLoadingDoctors } = useQuery({
        queryKey: ["doctors", bookingData.branchId],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_branch_doctors", {
                branch_id_input: bookingData.branchId,
            });

            if (error) throw error;
            return data || [];
        },
        enabled: step === 3 && !!bookingData.branchId
    });

    // 4. Fetch Slots (Availability)
    const { data: slots, isLoading: isLoadingSlots } = useQuery({
        queryKey: ["slots", bookingData.doctorId, bookingData.date],
        queryFn: async () => {
            const formattedDate = format(bookingData.date, "yyyy-MM-dd");
            const { data, error } = await supabase.rpc("get_doctor_availability", {
                p_doctor_id: bookingData.doctorId,
                p_date: formattedDate
            });
            if (error) throw error;
            return data as string[]; // Returns array of time strings "HH:MM:SS"
        },
        enabled: step === 4 && !!bookingData.doctorId
    });

    // 5. Fetch Existing Appointments (to block double booking)
    const { data: existingAppts } = useQuery({
        queryKey: ["existing_appts", bookingData.doctorId, bookingData.date],
        queryFn: async () => {
            const formattedDate = format(bookingData.date, "yyyy-MM-dd");
            const { data, error } = await supabase
                .from("appointments")
                .select("start_time")
                .eq("doctor_id", bookingData.doctorId)
                .eq("appointment_date", formattedDate)
                .in("status", ["pending", "confirmed", "checked_in"]); // exclude cancelled/rejected

            if (error) throw error;
            return data?.map(a => a.start_time.slice(0, 5)) || [];
        },
        enabled: step === 4 && !!bookingData.doctorId
    });

    // --- Mutation ---
    const bookingMutation = useMutation({
        mutationFn: async () => {
            if (!memberData) throw new Error("Member data missing");

            const payload = {
                doctor_id: bookingData.doctorId,
                member_id: memberData.member.id, // Always linked to principal
                dependant_id: bookingData.isDependant ? bookingData.patientId : null,
                appointment_date: format(bookingData.date, "yyyy-MM-dd"),
                start_time: bookingData.time,
                end_time: calculateEndTime(bookingData.time), // Helper needed or backend handles? let's calc basic 30m
                status: 'pending',
                branch_id: bookingData.branchId,
                notes: bookingData.reason
            };

            const { error } = await supabase.from("appointments").insert([payload as any]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["member_appointments"] });
            toast.success("Appointment booked successfully!");
            onSuccess();
        },
        onError: (err) => {
            toast.error("Booking failed: " + err.message);
        }
    });

    const calculateEndTime = (startTime: string) => {
        // Assume 30 mins for now, or fetch from settings
        const [hours, minutes] = startTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes + 30);
        return format(date, "HH:mm");
    };

    // --- Handlers ---

    const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handlePatientSelect = (val: string) => {
        setBookingData(prev => ({
            ...prev,
            patientId: val,
            isDependant: val !== "self"
        }));
    };

    const handleBranchSelect = (id: string) => {
        setBookingData(prev => ({
            ...prev,
            branchId: id,
            doctorId: "", // Reset doctor when branch changes
            time: ""      // Reset time when branch changes
        }));
        nextStep(); // Auto-advance to doctor selection
    };

    const handleDoctorSelect = (id: string) => {
        setBookingData(prev => ({
            ...prev,
            doctorId: id,
            time: "" // Reset time when doctor changes
        }));
        nextStep(); // Auto-advance to slot selection
    };

    // --- Renders ---

    const renderStepContent = () => {
        switch (step) {
            case 1: // Patient
                return (
                    <div className="space-y-4">
                        <Label>Who is this appointment for?</Label>
                        {isLoadingMember ? <Loader2 className="animate-spin" /> : (
                            <RadioGroup value={bookingData.patientId} onValueChange={handlePatientSelect} className="grid sm:grid-cols-2 gap-4">
                                <div className={cn("border rounded-lg p-4 cursor-pointer hover:bg-slate-50", bookingData.patientId === "self" && "border-primary bg-primary/5")}>
                                    <RadioGroupItem value="self" id="self" className="sr-only" />
                                    <Label htmlFor="self" className="flex items-center gap-3 cursor-pointer">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <User className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium">Myself</div>
                                            <div className="text-sm text-muted-foreground">{memberData?.member.full_name}</div>
                                        </div>
                                    </Label>
                                </div>
                                {memberData?.dependants.map(dep => (
                                    <div key={dep.id} className={cn("border rounded-lg p-4 cursor-pointer hover:bg-slate-50", bookingData.patientId === dep.id && "border-primary bg-primary/5")}>
                                        <RadioGroupItem value={dep.id} id={dep.id} className="sr-only" />
                                        <Label htmlFor={dep.id} className="flex items-center gap-3 cursor-pointer">
                                            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                                                <User className="h-5 w-5 text-orange-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{dep.full_name}</div>
                                                <div className="text-sm text-muted-foreground">Dependant</div>
                                            </div>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        )}
                    </div>
                );
            case 2: // Branch
                return (
                    <div className="space-y-4">
                        <Label>Select a Branch</Label>
                        {isLoadingBranches ? <Loader2 className="animate-spin" /> : (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {branches?.map(branch => (
                                    <div
                                        key={branch.id}
                                        className={cn(
                                            "border rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-slate-50",
                                            bookingData.branchId === branch.id && "border-primary bg-primary/5 ring-1 ring-primary"
                                        )}
                                        onClick={() => handleBranchSelect(branch.id)}
                                    >
                                        <MapPin className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-medium">{branch.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 3: // Doctor
                return (
                    <div className="space-y-4">
                        <Label>Select a Doctor (Optional)</Label>
                        {isLoadingDoctors ? <Loader2 className="animate-spin" /> : (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {doctors?.map(doc => (
                                    <div
                                        key={doc.id}
                                        className={cn(
                                            "border rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-slate-50",
                                            bookingData.doctorId === doc.id && "border-primary bg-primary/5 ring-1 ring-primary"
                                        )}
                                        onClick={() => handleDoctorSelect(doc.id)}
                                    >
                                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                                            DR
                                        </div>
                                        <div>
                                            <div className="font-medium">{doc.full_name}</div>
                                            <div className="text-xs text-muted-foreground">General Dentist</div>
                                        </div>
                                    </div>
                                ))}
                                {doctors?.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                                        No doctors found for this branch.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case 4: // Date & Time
                return (
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <Label className="mb-2 block">Pick a Date</Label>
                            <Calendar
                                mode="single"
                                selected={bookingData.date}
                                onSelect={(d) => d && setBookingData(prev => ({ ...prev, date: d, time: "" }))}
                                className="rounded-md border"
                                disabled={(date) => date < new Date() || date.getDay() === 0} // Disable past dates and Sundays (example)
                            />
                        </div>
                        <div>
                            <Label className="mb-2 block">Available Slots</Label>
                            {isLoadingSlots ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                            ) : !slots || slots.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground border rounded-md border-dashed h-[280px] flex items-center justify-center">
                                    No slots available for this date.
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                                    {slots.map(slot => {
                                        // Check if slot is in the past
                                        const isToday = new Date().toDateString() === bookingData.date.toDateString();
                                        let isPast = false;

                                        if (isToday) {
                                            const [hours, minutes] = slot.split(':').map(Number);
                                            const slotDate = new Date();
                                            slotDate.setHours(hours, minutes, 0, 0);
                                            if (slotDate < new Date()) {
                                                isPast = true;
                                            }
                                        }

                                        // Check if slot is booked
                                        const formattedSlot = slot.slice(0, 5);
                                        const isBooked = existingAppts?.includes(formattedSlot);


                                        return (
                                            <Button
                                                key={slot}
                                                variant={bookingData.time === slot ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setBookingData(prev => ({ ...prev, time: slot }))}
                                                className={cn("text-xs", isBooked && "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 decoration-slate-400")}
                                                disabled={isPast || isBooked}
                                                title={isBooked ? "Slot already booked" : ""}
                                            >
                                                {slot.slice(0, 5)}
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 5: // Confirm
                const selectedBranch = branches?.find(b => b.id === bookingData.branchId);
                const selectedDoctor = doctors?.find(d => d.id === bookingData.doctorId);
                const patientName = bookingData.isDependant
                    ? memberData?.dependants.find(d => d.id === bookingData.patientId)?.full_name
                    : memberData?.member.full_name;

                return (
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-lg space-y-4 border">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                Confirm Appointment Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block">Patient</span>
                                    <span className="font-medium">{patientName}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Branch</span>
                                    <span className="font-medium">{selectedBranch?.name}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Doctor</span>
                                    <span className="font-medium">{selectedDoctor?.full_name}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Date & Time</span>
                                    <span className="font-medium">{format(bookingData.date, "MMM do, yyyy")} at {bookingData.time.slice(0, 5)}</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                            A confirmation SMS will be sent to your registered phone number once booked.
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    const isStepValid = () => {
        switch (step) {
            case 1: return !!bookingData.patientId;
            case 2: return !!bookingData.branchId;
            case 3: return !!bookingData.doctorId;
            case 4: return !!bookingData.date && !!bookingData.time;
            case 5: return true;
            default: return false;
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center justify-between relative">
                    {/* Progress Bar Background */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10" />

                    {STEPS.map((s, idx) => (
                        <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                                step >= s.id ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-400"
                            )}>
                                {s.id}
                            </div>
                            <span className={cn("text-xs font-medium", step >= s.id ? "text-primary" : "text-muted-foreground")}>
                                {s.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <Card>
                <CardContent className="pt-6 min-h-[400px] flex flex-col justify-between">
                    <div>
                        {renderStepContent()}
                    </div>

                    <div className="flex justify-between pt-8 border-t mt-6">
                        <Button variant="outline" onClick={prevStep} disabled={step === 1}>
                            Back
                        </Button>

                        {step === 5 ? (
                            <Button onClick={() => bookingMutation.mutate()} disabled={bookingMutation.isPending}>
                                {bookingMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                                Confirm Booking
                            </Button>
                        ) : (
                            <Button onClick={nextStep} disabled={!isStepValid()}>
                                Next
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default BookingWizard;
