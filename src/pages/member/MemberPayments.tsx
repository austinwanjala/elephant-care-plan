import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: number;
  coverage_added: number;
  status: string | null;
  payment_date: string | null;
  mpesa_reference: string | null;
  created_at: string;
}

export default function MemberPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
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
      .from("payments")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    setPayments(data || []);
    setLoading(false);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-600";
      case "pending": return "bg-yellow-500/10 text-yellow-600";
      case "failed": return "bg-red-500/10 text-red-600";
      default: return "bg-muted text-muted-foreground";
    }
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
        <h1 className="text-2xl font-bold">Payment History</h1>
        <p className="text-muted-foreground">View your contribution history</p>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No payments found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">KES {payment.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Coverage added: KES {payment.coverage_added.toLocaleString()}
                    </p>
                    {payment.mpesa_reference && (
                      <p className="text-xs text-muted-foreground">
                        Ref: {payment.mpesa_reference}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <Badge className={getStatusColor(payment.status)}>
                      {payment.status || "Unknown"}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.payment_date || payment.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
