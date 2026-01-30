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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Loader2, AlertCircle } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";

interface Visit {
  id: string;
  created_at: string;
  members: { full_name: string; member_number: string } | null;
  services: { name: string } | null;
  benefit_deducted: number;
}

interface StaffInfo {
  branch_id: string | null;
}

export default function TodaysList() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadStaffAndVisits();
  }, []);

  const loadStaffAndVisits = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffData } = await supabase
      .from("staff")
      .select("branch_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffData?.branch_id) {
      setStaffInfo(staffData);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { data, error } = await supabase
        .from("visits")
        .select("*, members(full_name, member_number), services(name)")
        .eq("branch_id", staffData.branch_id)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error loading visits",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setVisits(data || []);
      }
    } else {
      setStaffInfo(staffData); // Set staffInfo even if branch_id is null to trigger the conditional render
      toast({
        title: "Branch not assigned",
        description: "Your staff profile is not assigned to a branch.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // NEW: Display message if staff is not assigned to a branch
  if (!staffInfo?.branch_id) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" /> Branch Not Assigned
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your staff profile is not assigned to a branch. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Processed Visits Today</h1>
        <p className="text-muted-foreground">Services processed at your branch today</p>
      </div>

      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Visits for {new Date().toLocaleDateString()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Benefit Deducted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No patients visited your branch today.
                    </TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>
                        {new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{visit.members?.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {visit.members?.member_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{visit.services?.name || "N/A"}</TableCell>
                      <TableCell className="text-destructive">
                        -KES {visit.benefit_deducted.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}