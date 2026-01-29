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
import { Stethoscope, Loader2, Shield, AlertCircle } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  real_cost: number;
  branch_compensation: number;
  benefit_cost: number;
  profit_loss: number;
  approval_type: "all_branches" | "pre_approved_only";
  is_active: boolean;
}

interface StaffInfo {
  branch_id: string | null;
  branches: { name: string } | null;
}

export default function BranchServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [preapprovedServiceIds, setPreapprovedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadStaffAndServices();
  }, []);

  const loadStaffAndServices = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffData } = await supabase
      .from("staff")
      .select("branch_id, branches(name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffData?.branch_id) {
      setStaffInfo(staffData);
      const [servicesRes, preapprovalsRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("name"),
        supabase.from("service_preapprovals").select("service_id").eq("branch_id", staffData.branch_id),
      ]);

      if (servicesRes.error) {
        toast({
          title: "Error loading services",
          description: servicesRes.error.message,
          variant: "destructive",
        });
      } else {
        setServices(servicesRes.data || []);
      }

      if (preapprovalsRes.error) {
        toast({
          title: "Error loading pre-approvals",
          description: preapprovalsRes.error.message,
          variant: "destructive",
        });
      } else {
        setPreapprovedServiceIds(preapprovalsRes.data?.map((p) => p.service_id) || []);
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

  const isServiceAvailableAtBranch = (service: Service): boolean => {
    if (service.approval_type === "all_branches") return true;
    return preapprovedServiceIds.includes(service.id);
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
        <h1 className="text-3xl font-serif font-bold text-foreground">Branch Services</h1>
        <p className="text-muted-foreground">Services offered at {staffInfo?.branches?.name || "your assigned branch"}</p>
      </div>

      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Available Services
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Benefit Cost</TableHead>
                  <TableHead>Branch Comp.</TableHead>
                  <TableHead>Profit/Loss</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No active services found for your branch.
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>KES {service.benefit_cost.toLocaleString()}</TableCell>
                      <TableCell>KES {service.branch_compensation.toLocaleString()}</TableCell>
                      <TableCell className={service.profit_loss >= 0 ? "text-success" : "text-destructive"}>
                        KES {service.profit_loss.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isServiceAvailableAtBranch(service) ? (
                          <Badge className="bg-success">Available</Badge>
                        ) : (
                          <Badge variant="secondary">Pre-approval needed</Badge>
                        )}
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