import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { exportToCsv } from "@/utils/csvExport";

type CommissionStatus = "pending_activation" | "claimable" | "claimed" | "paid" | "rejected";

type CommissionRow = {
  id: string;
  marketer_id: string;
  member_id: string;
  amount: number;
  status: CommissionStatus;
  created_at: string;
  claimable_at: string | null;
  claimed_at: string | null;
  paid_at: string | null;
  claim_id: string | null;
  marketers?: { full_name: string; code: string } | null;
  members?: { full_name: string; member_number: string } | null;
};

export default function AdminMarketerCommissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [marketers, setMarketers] = useState<{ id: string; full_name: string; code: string }[]>([]);

  const [selectedMarketerId, setSelectedMarketerId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        supabase.from("marketers").select("id, full_name, code").order("full_name"),
        (supabase as any)
          .from("marketer_commissions")
          .select("*, marketers(full_name, code), members(full_name, member_number)")
          .order("created_at", { ascending: false }),
      ]);

      if (mRes.error) throw mRes.error;
      if (cRes.error) throw cRes.error;

      setMarketers(mRes.data || []);
      setRows(cRes.data || []);
    } catch (e: any) {
      toast({ title: "Error loading commissions", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedMarketerId !== "all" && r.marketer_id !== selectedMarketerId) return false;
      if (selectedStatus !== "all" && r.status !== selectedStatus) return false;
      return true;
    });
  }, [rows, selectedMarketerId, selectedStatus]);

  const exportCsv = () => {
    exportToCsv(
      "marketer_commissions.csv",
      filtered.map((r) => ({
        "Marketer": r.marketers?.full_name || r.marketer_id,
        "Marketer Code": r.marketers?.code || "",
        "Member": r.members?.full_name || r.member_id,
        "Member #": r.members?.member_number || "",
        "Amount": r.amount,
        "Status": r.status,
        "Created": r.created_at,
        "Claimable At": r.claimable_at || "",
        "Claimed At": r.claimed_at || "",
        "Paid At": r.paid_at || "",
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Marketer Commissions</h1>
        <p className="text-muted-foreground">Track referral commissions lifecycle (pending → claimable → claimed → paid).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by marketer and status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={selectedMarketerId} onValueChange={setSelectedMarketerId}>
            <SelectTrigger className="w-full md:w-[320px]"><SelectValue placeholder="All marketers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All marketers</SelectItem>
              {marketers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name} ({m.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full md:w-[260px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_activation">pending_activation</SelectItem>
              <SelectItem value="claimable">claimable</SelectItem>
              <SelectItem value="claimed">claimed</SelectItem>
              <SelectItem value="paid">paid</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button variant="outline" onClick={exportCsv} disabled={loading}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-slate-50/50">
          <CardTitle>Commission Records</CardTitle>
          <CardDescription>{filtered.length} records</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marketer</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Claimable</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No commission records.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.marketers?.full_name || "-"}</div>
                        <div className="text-xs text-muted-foreground">{r.marketers?.code || r.marketer_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.members?.full_name || "-"}</div>
                        <div className="text-xs text-muted-foreground">{r.members?.member_number || r.member_id}</div>
                      </TableCell>
                      <TableCell className="font-semibold">KES {Number(r.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{r.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-xs">{r.claimable_at ? new Date(r.claimable_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-xs">{r.claimed_at ? new Date(r.claimed_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-xs">{r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "-"}</TableCell>
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
