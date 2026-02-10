import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DoctorScheduleManager from "@/components/admin/DoctorScheduleManager";

const settingsSchema = z.object({
    slot_duration_minutes: z.coerce.number().min(5).max(120),
    opening_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    closing_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const AppointmentSettings = () => {
    const queryClient = useQueryClient();
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

    // Fetch branches
    const { data: branches } = useQuery({
        queryKey: ["branches"],
        queryFn: async () => {
            const { data, error } = await supabase.from("branches").select("*").order("name");
            if (error) throw error;
            return data;
        },
    });

    // Fetch settings for selected branch (or global if null)
    const { data: settings } = useQuery({
        queryKey: ["appointment_settings", selectedBranchId],
        queryFn: async () => {
            let query = supabase.from("appointment_settings").select("*");
            if (selectedBranchId) {
                query = query.eq("branch_id", selectedBranchId);
            } else {
                query = query.is("branch_id", null);
            }
            const { data, error } = await query.maybeSingle(); // Use maybeSingle to avoid 406 on no rows

            if (error) throw error;
            return data;
        },
    });

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            slot_duration_minutes: 30,
            opening_time: "08:00",
            closing_time: "17:00",
        },
    });

    // Update form when settings load
    useEffect(() => {
        if (settings) {
            form.reset({
                slot_duration_minutes: settings.slot_duration_minutes,
                opening_time: settings.opening_time.slice(0, 5), // Remove seconds if present
                closing_time: settings.closing_time.slice(0, 5),
            });
        } else {
            // Reset to defaults if no settings found
            form.reset({
                slot_duration_minutes: 30,
                opening_time: "08:00",
                closing_time: "17:00",
            });
        }
    }, [settings, form]);

    const mutation = useMutation({
        mutationFn: async (values: SettingsFormValues) => {
            const payload = {
                branch_id: selectedBranchId === "global" ? null : selectedBranchId,
                ...values,
            };

            if (settings?.id) {
                const { error } = await supabase
                    .from("appointment_settings")
                    .update(payload)
                    .eq("id", settings.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("appointment_settings")
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointment_settings"] });
            toast.success("Settings saved successfully");
        },
        onError: (error) => {
            toast.error("Failed to save settings: " + error.message);
        },
    });

    function onSubmit(values: SettingsFormValues) {
        mutation.mutate(values);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Appointment Settings</h2>
            </div>

            <div className="flex items-center gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <label htmlFor="branch-select" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Configuration Scope</label>
                    <Select
                        value={selectedBranchId || "global"}
                        onValueChange={(val) => setSelectedBranchId(val === "global" ? null : val)}
                    >
                        <SelectTrigger className="w-[280px]" id="branch-select">
                            <SelectValue placeholder="Select Scope" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="global">Global Default</SelectItem>
                            {branches?.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                    {branch.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-[0.8rem] text-muted-foreground">Select 'Global Default' to apply to all branches unless overridden.</p>
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList>
                    <TabsTrigger value="general">General Configuration</TabsTrigger>
                    <TabsTrigger value="schedule">Doctor Schedules</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Time Slots & Hours</CardTitle>
                            <CardDescription>
                                Configure default appointment duration and daily operating hours for {selectedBranchId ? "this branch" : "all branches"}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="slot_duration_minutes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Slot Duration (Minutes)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Standard duration for regular consultations (e.g., 15, 20, 30).
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="opening_time"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Opening Time</FormLabel>
                                                    <FormControl>
                                                        <Input type="time" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="closing_time"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Closing Time</FormLabel>
                                                    <FormControl>
                                                        <Input type="time" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Button type="submit" disabled={mutation.isPending}>
                                        {mutation.isPending ? "Saving..." : "Save Changes"}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Doctor Schedules</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DoctorScheduleManager />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AppointmentSettings;
