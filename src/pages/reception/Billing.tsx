import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Check, Search, Receipt, History, Printer, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyCredential, registerCredential } from "@/lib/webauthn";
import { InsufficientBalanceHandler } from "@/components/reception/InsufficientBalanceHandler";

export default function ReceptionBilling() {
    const [visits, setVisits] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [receptionistId, setReceptionistId] = useState<string | null>(null);
    const [receptionistBranchId, setReceptionistBranchId] = useState<string | null>(null);
    const [biometricsVerified, setBiometricsVerified] = useState<string | null>(null); // visitId if verified
    const [showPaymentHandler, setShowPaymentHandler] = useState<string | null>(null); // visitId
    const { toast } = useToast();

    useEffect(() => {
        fetchReceptionistInfo();
    }, []);

    useEffect(() => {
        if (receptionistBranchId) {
            fetchBilledVisits();
        }
    }, [receptionistBranchId]);

    const fetchReceptionistInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staffData, error: staffError } = await supabase
            .from("staff")
            .select("id, branch_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (staffError || !staffData) {
            toast({ title: "Error", description: "Could not retrieve receptionist profile.", variant: "destructive" });
            return;
        }
        setReceptionistId(staffData.id);
        setReceptionistBranchId(staffData.branch_id);
    };

    const fetchBilledVisits = async () => {
        if (!receptionistBranchId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(id, full_name, phone, member_number, coverage_balance, biometric_data), branches(name), bills(*, bill_items(*))")
            .in("status", ["billed", "billing_pending"])
            .eq('branch_id', receptionistBranchId)
            .order("updated_at", { ascending: false });

        if (error) {
            toast({ title: "Error fetching bills", description: error.message, variant: "destructive" });
        } else {
            setVisits(data || []);
        }
        setLoading(false);
    };

    const fetchHistory = async () => {
        if (!receptionistBranchId) return;
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from("visits")
            .select("*, members(full_name, member_number), branches(name), bills(*, bill_items(*))")
            .eq("status", "completed")
            .eq('branch_id', receptionistBranchId)
            .order("updated_at", { ascending: false })
            .limit(50);

        if (error) {
            toast({ title: "Error fetching history", description: error.message, variant: "destructive" });
        } else {
            setHistory(data || []);
        }
        setLoadingHistory(false);
    };

    const handleFinalizeBill = async (visit: any, billId: string) => {
        if (!receptionistId) {
            toast({ title: "Error", description: "Receptionist ID not found.", variant: "destructive" });
            return;
        }
        setProcessingId(visit.id);
        console.log("Attempting finalize_invoice_rpc (v2) with:", { p_bill_id: billId, p_receptionist_id: receptionistId });
        try {
            const { data, error } = await (supabase.rpc as any)('finalize_invoice_rpc', {
                p_bill_id: billId,
                p_receptionist_id: receptionistId
            });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            // Send Billing Completion SMS
            try {
                const bill = visit.bills?.[0];
                const newBalance = (visit.members?.coverage_balance || 0) - (bill?.total_benefit_cost || 0);

                await supabase.functions.invoke('send-sms', {
                    body: {
                        type: 'billing_completion',
                        phone: visit.members?.phone,
                        data: {
                            benefit_cost: bill?.total_benefit_cost,
                            balance: Math.max(0, newBalance)
                        }
                    }
                });
            } catch (smsErr) {
                console.error("Failed to send billing SMS:", smsErr);
            }

            toast({ title: "Bill Finalized", description: "Coverage deducted and visit completed." });

            // Log System Action
            await (supabase as any).from("system_logs").insert({
                action: "Bill Finalized",
                details: { visit_id: visit.id, bill_id: billId, receptionist_id: receptionistId },
                user_id: (await supabase.auth.getUser()).data.user?.id
            });

            fetchBilledVisits();
        } catch (error: any) {
            toast({ title: "Finalization Failed", description: error.message, variant: "destructive" });
        } finally {
            setProcessingId(null);
            setBiometricsVerified(null);
        }
    };

    const handlePrintInvoice = (visit: any) => {
        const bill = visit.bills?.[0];
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <html>
            <head>
                <title>Invoice - ${visit.members.full_name}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
                    .header { border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .logo { font-size: 28px; font-weight: 900; color: #1e40af; letter-spacing: -1px; }
                    .invoice-label { font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: bold; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                    .section-title { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    th { text-align: left; background: #f8fafc; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 13px; }
                    td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px; }
                    .total-section { display: flex; justify-content: flex-end; }
                    .total-table { width: 320px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 12px; }
                    .grand-total { background: #1e40af; color: white; border-radius: 6px; margin-top: 12px; padding: 12px; font-weight: bold; font-size: 18px; }
                    .footer { margin-top: 80px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header" style="border-bottom: 2px solid #10b981; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="/img/elephant-logo.png" style="width: 70px; height: 70px; object-fit: contain;" />
                        <div>
                            <div style="font-size: 32px; font-weight: 800; color: #064e3b; line-height: 1; letter-spacing: 1px;">ELEPHANT</div>
                            <div style="font-size: 32px; font-weight: 800; color: #10b981; line-height: 1; letter-spacing: 1px;">DENTAL</div>
                            <div style="font-size: 11px; color: #064e3b; font-style: italic; margin-top: 5px; font-weight: 600;">...the epitome of dental solutions</div>
                        </div>
                    </div>
                    <div style="text-align: right; color: #064e3b; font-size: 11px; line-height: 1.4;">
                        <div style="font-weight: 800; text-decoration: underline; margin-bottom: 5px; border: 1px solid #10b981; padding: 2px 8px; display: inline-block;">HEAD OFFICE</div>
                        <div>P. O. Box 643 - 60200, Meru</div>
                        <div>Mobile: +254 710 500 500</div>
                        <div>Email: elephantkenya@gmail.com</div>
                        <div>Website: www.elephantdental.org</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px;">
                    <h2 style="margin: 0; color: #1e293b; font-size: 24px;">VISIT INVOICE</h2>
                    <div style="background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px;">PAID / COVERED</div>
                </div>
                <div class="info-grid">
                    <div>
                        <div class="section-title">Patient Information</div>
                        <strong>${visit.members.full_name}</strong><br>
                        Member Account: ${visit.members.member_number}<br>
                        Branch: ${visit.branches?.name || 'N/A'}
                    </div>
                    <div>
                        <div class="section-title">Invoice Details</div>
                        Invoice ID: INV-${visit.id.slice(0, 8).toUpperCase()}<br>
                        Visit Date: ${new Date(visit.created_at).toLocaleDateString()}<br>
                        Generated: ${new Date().toLocaleString()}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Medical Service / Procedure</th>
                            <th style="text-align: right">Benefit Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bill?.bill_items?.map((item: any) => `
                            <tr>
                                <td>${item.service_name}</td>
                                <td style="text-align: right">KES ${Number(item.benefit_cost).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total-section">
                    <div class="total-table">
                        <div class="total-row">
                            <span>Total Visit Cost:</span>
                            <span>KES ${Number(bill?.total_benefit_cost).toLocaleString()}</span>
                        </div>
                        <div class="total-row" style="color: #10b981">
                            <span>Member Coverage Applied:</span>
                            <span>- KES ${Number(bill?.total_benefit_cost).toLocaleString()}</span>
                        </div>
                        <div class="total-row grand-total" style="background: #10b981">
                            <span>Balance Due:</span>
                            <span>KES 0.00</span>
                        </div>
                    </div>
                </div>
                <div class="footer">
                    Thank you for trusting Elephant Dental with your care.<br>
                    Providing accessible oral healthcare for everyone across Kenya.
                </div>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const filteredVisits = visits.filter(v =>
        v.members?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.members?.member_number?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-blue-900">Billing & Invoices</h1>
                    <p className="text-muted-foreground">Finalize visit billing and manage patient invoices.</p>
                </div>
            </div>

            <div className="flex items-center space-x-2 w-full max-w-sm bg-white rounded-lg px-3 border border-border">
                <Search className="text-muted-foreground h-4 w-4" />
                <Input
                    placeholder="Search patient..."
                    className="border-0 focus-visible:ring-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <Tabs defaultValue="pending" className="w-full" onValueChange={(val) => val === 'history' && fetchHistory()}>
                <TabsList className="bg-white border p-1 rounded-lg">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Pending Finalization
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Billing History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4">
                    <Card className="shadow-sm border-blue-100">
                        <CardHeader className="bg-blue-50/50">
                            <CardTitle>Doctor Submitted Bills</CardTitle>
                            <CardDescription>Waiting for coverage deduction and final verification.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Patient</TableHead>
                                            <TableHead>Branch</TableHead>
                                            <TableHead>Services</TableHead>
                                            <TableHead>Benefit Cost</TableHead>
                                            <TableHead>Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
                                        ) : filteredVisits.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No pending bills.</TableCell></TableRow>
                                        ) : (
                                            filteredVisits.map((visit) => {
                                                const bill = visit.bills?.[0];
                                                return (
                                                    <TableRow key={visit.id}>
                                                        <TableCell>{new Date(visit.created_at).toLocaleDateString()}</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium text-slate-900">{visit.members?.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{visit.members?.member_number}</div>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {visit.branches?.name || "N/A"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="max-w-[200px] truncate text-slate-600">
                                                                {bill?.bill_items?.map((item: any) => item.service_name).join(", ")}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-bold text-blue-700">
                                                            KES {(bill?.total_benefit_cost || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                                        Review & Finalize
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="max-w-2xl">
                                                                    <DialogHeader>
                                                                        <DialogTitle>Complete Finalization</DialogTitle>
                                                                        <DialogDescription>
                                                                            Verify services for <b>{visit.members?.full_name}</b>.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                                                                        <div className="border rounded-lg overflow-hidden overflow-x-auto">
                                                                            <Table>
                                                                                <TableHeader className="bg-slate-50">
                                                                                    <TableRow>
                                                                                        <TableHead>Service</TableHead>
                                                                                        <TableHead>Tooth</TableHead>
                                                                                        <TableHead className="text-right">Benefit</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {bill?.bill_items?.map((item: any) => (
                                                                                        <TableRow key={item.id}>
                                                                                            <TableCell>{item.service_name}</TableCell>
                                                                                            <TableCell>
                                                                                                {item.tooth_number ? (
                                                                                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                                                                                        #{item.tooth_number}
                                                                                                    </Badge>
                                                                                                ) : "—"}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">KES {Number(item.benefit_cost).toLocaleString()}</TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                    <TableRow className="bg-slate-50 font-bold">
                                                                                        <TableCell>Total Deduction</TableCell>
                                                                                        <TableCell className="text-right text-blue-700">KES {Number(bill?.total_benefit_cost).toLocaleString()}</TableCell>
                                                                                    </TableRow>
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                        <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
                                                                            Patient Coverage Balance: <b>KES {visit.members?.coverage_balance?.toLocaleString()}</b>
                                                                        </div>

                                                                        <div className="p-3 bg-amber-50 text-amber-900 rounded-md text-sm border border-amber-200">
                                                                            <div className="font-bold mb-1">Doctor's Diagnosis & Notes:</div>
                                                                            <p className="italic">"{visit.diagnosis || visit.treatment_notes || 'No notes provided'}"</p>
                                                                        </div>

                                                                        {visit.members?.coverage_balance < bill?.total_benefit_cost && !showPaymentHandler && (
                                                                            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
                                                                                <div className="flex justify-between items-center">
                                                                                    <span>Insufficient Balance!</span>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="destructive"
                                                                                        className="h-7 text-xs"
                                                                                        onClick={() => setShowPaymentHandler(visit.id)}
                                                                                    >
                                                                                        Renew / Top-up
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {showPaymentHandler === visit.id && (
                                                                            <InsufficientBalanceHandler
                                                                                member={visit.members}
                                                                                requiredAmount={bill?.total_benefit_cost}
                                                                                onPaymentSuccess={async () => {
                                                                                    setShowPaymentHandler(null);
                                                                                    await fetchBilledVisits();
                                                                                    toast({ title: "Success", description: "Coverage updated. You can now finalize the bill." });
                                                                                }}
                                                                                onCancel={() => setShowPaymentHandler(null)}
                                                                            />
                                                                        )}

                                                                        { /* Biometrics optional */}
                                                                        <div className="py-2 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                                                                            <Button
                                                                                variant={biometricsVerified === visit.id ? "default" : "outline"}
                                                                                className={`w-full py-6 text-lg border-2 ${biometricsVerified === visit.id ? 'bg-green-600 hover:bg-green-700 border-green-600' : 'border-blue-200 hover:border-blue-400 text-blue-700'}`}
                                                                                onClick={async () => {
                                                                                    if (biometricsVerified === visit.id) return; // Already verified
                                                                                    /* Biometric logic preserved but now optional */
                                                                                    if (!visit.members.biometric_data) {
                                                                                        try {
                                                                                            const credentialData = await registerCredential(visit.members.id, visit.members.full_name);
                                                                                            const { error } = await supabase.from("members").update({ biometric_data: credentialData }).eq("id", visit.members.id);
                                                                                            if (error) throw error;
                                                                                            toast({ title: "Biometrics Captured", description: "Identity captured and mapped to this member." });
                                                                                            visit.members.biometric_data = credentialData;
                                                                                            setBiometricsVerified(visit.id);
                                                                                        } catch (err: any) {
                                                                                            toast({ title: "Capture Failed", description: err.message || "Failed to capture biometrics.", variant: "destructive" });
                                                                                        }
                                                                                        return;
                                                                                    }
                                                                                    try {
                                                                                        const isVerified = await verifyCredential(visit.members.biometric_data);
                                                                                        if (isVerified) {
                                                                                            setBiometricsVerified(visit.id);
                                                                                            toast({ title: "Biometrics Verified", description: "Identity confirmed via biometric scan." });
                                                                                        }
                                                                                    } catch (err: any) {
                                                                                        console.error("Biometric error:", err);
                                                                                        toast({ title: "Verification Error", description: err.message || "Biometric validation failed.", variant: "destructive" });
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {biometricsVerified === visit.id ? (
                                                                                    <><Check className="mr-2 h-6 w-6" /> Biometrics Confirmed</>
                                                                                ) : !visit.members?.biometric_data ? (
                                                                                    <><Fingerprint className="mr-2 h-6 w-6" /> Capture Member Biometrics (Optional)</>
                                                                                ) : (
                                                                                    <><Fingerprint className="mr-2 h-6 w-6" /> Verify Member Biometrics (Optional)</>
                                                                                )}
                                                                            </Button>
                                                                            <p className="text-[10px] text-center text-muted-foreground mt-1">Authorization via biometrics is now optional.</p>
                                                                        </div>
                                                                    </div>
                                                                    <DialogFooter>
                                                                        <Button
                                                                            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                                                                            onClick={() => handleFinalizeBill(visit, bill?.id)}
                                                                            disabled={processingId === visit.id}
                                                                        >
                                                                            {processingId === visit.id ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Check className="mr-2 h-5 w-5" />}
                                                                            Finalize & Deduct Coverage
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
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
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <Card className="shadow-sm border-slate-100">
                        <CardHeader>
                            <CardTitle>Billing History</CardTitle>
                            <CardDescription>Recently closed visits. You can re-print invoices here.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Patient</TableHead>
                                            <TableHead>Branch</TableHead>
                                            <TableHead>Services</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingHistory ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
                                        ) : history.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No history records found.</TableCell></TableRow>
                                        ) : (
                                            history.map((h) => (
                                                <TableRow key={h.id}>
                                                    <TableCell>{new Date(h.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{h.members?.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">{h.members?.member_number}</div>
                                                    </TableCell>
                                                    <TableCell>{h.branches?.name || "N/A"}</TableCell>
                                                    <TableCell>
                                                        <div className="max-w-[200px] truncate">
                                                            {h.bills?.[0]?.bill_items?.map((i: any) => i.service_name).join(", ")}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>KES {Number(h.bills?.[0]?.total_benefit_cost || 0).toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <Button variant="outline" size="sm" onClick={() => handlePrintInvoice(h)}>
                                                            <Printer className="mr-2 h-4 w-4" /> Invoice
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}