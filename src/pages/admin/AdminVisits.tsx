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
import { History, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/utils/csvExport";

interface Visit {
  id: string;
  created_at: string;
  status: string;
  diagnosis: string | null;
  treatment_notes: string | null;
  benefit_deducted: number;
  branch_compensation: number;
  profit_loss: number;
  notes: string | null;
  members: { full_name: string; member_number: string } | null;
<<<<<<< HEAD

=======
>>>>>>> 9ce1b7bf4df1d33d0fb034d895010586efa5354c
  branches: { name: string } | null;
  receptionist: { full_name: string } | null;
  doctor: { full_name: string } | null;
  bills: { total_benefit_cost: number; total_branch_compensation: number; total_profit_loss: number; bill_items: { service_name: string }[] }[] | null;
}

export default function AdminVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadVisits();
  }, []);

  const loadVisits = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("visits")
      .select("*, members(full_name, member_number), branches(name), bills(total_benefit_cost, total_branch_compensation, total_profit_loss, bill_items(service_name))")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading visits",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setVisits((data || []) as any);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return <Badge variant="secondary">Registered</Badge>;
      case "with_doctor":
        return <Badge className="bg-blue-500/10 text-blue-600">With Doctor</Badge>;
      case "billed":
        return <Badge className="bg-orange-500/10 text-orange-600">Billed</Badge>;
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExport = () => {
    const dataToExport = visits.map(v => {
      const bill = v.bills?.[0];
      return {
        "Date": format(new Date(v.created_at), "yyyy-MM-dd HH:mm"),
        "Member Name": v.members?.full_name || "N/A",
        "Member Number": v.members?.member_number || "N/A",
        "Branch": v.branches?.name || "N/A",
        "Doctor": v.doctor?.full_name || "N/A",
        "Receptionist": v.receptionist?.full_name || "N/A",
        "Services": bill?.bill_items?.map((item: any) => item.service_name).join(", ") || "N/A",
        "Diagnosis": v.diagnosis || "N/A",
        "Status": v.status,
        "Benefit Deducted": bill?.total_benefit_cost || 0,
        "Branch Compensation": bill?.total_branch_compensation || 0,
        "Profit/Loss": bill?.total_profit_loss || 0
      };
    });
    exportToCsv("visits_export.csv", dataToExport);
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
          <h1 className="text-3xl font-serif font-bold text-foreground">All Visits</h1>
          <p className="text-muted-foreground">Comprehensive record of all processed dental services</p>
        </div>
        <div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="card-elevated overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Processed Services
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Receptionist</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Benefit Deducted</TableHead>
                  <TableHead>Branch Comp.</TableHead>
                  <TableHead>Profit/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No visits recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => {
                    const bill = visit.bills?.[0];
                    const servicesList = bill?.bill_items?.map(item => item.service_name).join(", ") || "N/A";
                    const benefitDeducted = bill?.total_benefit_cost || 0;
                    const branchCompensation = bill?.total_branch_compensation || 0;
                    const profitLoss = bill?.total_profit_loss || 0;

                    return (
                      <TableRow key={visit.id}>
                        <TableCell>
                          {format(new Date(visit.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{visit.members?.full_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {visit.members?.member_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{visit.branches?.name || "N/A"}</TableCell>
                        <TableCell>{visit.doctor?.full_name || "N/A"}</TableCell>
                        <TableCell>{visit.receptionist?.full_name || "N/A"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{servicesList}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{visit.diagnosis || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(visit.status || "unknown")}</TableCell>
                        <TableCell className="text-destructive">
                          -KES {benefitDeducted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-success">
                          +KES {branchCompensation.toLocaleString()}
                        </TableCell>
                        <TableCell className={profitLoss >= 0 ? "text-success" : "text-destructive"}>
                          KES {profitLoss.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}