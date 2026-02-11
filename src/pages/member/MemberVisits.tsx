import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, History } from "lucide-react";
import { format } from "date-fns";

interface Visit {
  id: string;
  created_at: string;
  status: string;
  notes: string | null;
  branches: { name: string } | null;
  bills: {
    total_benefit_cost: number;
    total_real_cost: number;
    bill_items: { service_name: string }[]
  }[] | null;
}

export default function MemberVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("visits")
      .select(`
        id, 
        created_at, 
        status,
        notes, 
        branches(name), 
        bills(
          total_benefit_cost, 
          total_real_cost,
          bill_items(service_name)
        )
      `)
      .eq("member_id", member.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    setVisits(data as any || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visit History</h1>
        <p className="text-muted-foreground">Your dental service records</p>
      </div>

      {visits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No visits recorded</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => {
            const isPending = visit.status !== 'completed';
            const bill = visit.bills?.[0];
            const serviceNames = isPending
              ? "Processing..."
              : (bill?.bill_items?.map(i => i.service_name).join(", ") || "Consultation");

            const amountDisplay = isPending
              ? "Pending"
              : `-KES ${(bill?.total_benefit_cost || 0).toLocaleString()}`;

            return (
              <Card key={visit.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{serviceNames}</p>
                      <p className="text-sm text-muted-foreground">{visit.branches?.name || "Unknown Branch"}</p>
                      {visit.notes && <p className="text-xs text-muted-foreground">{visit.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isPending ? "text-muted-foreground" : "text-destructive"}`}>
                        {amountDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(visit.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}