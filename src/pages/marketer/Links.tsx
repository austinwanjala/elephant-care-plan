import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Link2, Copy, QrCode } from "lucide-react";

interface MarketerInfo {
    id: string;
    code: string;
}

export default function MarketerLinks() {
    const [loading, setLoading] = useState(true);
    const [marketer, setMarketer] = useState<MarketerInfo | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchMarketerInfo();
    }, []);

    const fetchMarketerInfo = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }

        const { data: mData, error: mError } = await supabase
            .from("marketers")
            .select("id, code")
            .eq("user_id", user.id)
            .maybeSingle();

        if (mError || !mData) {
            toast({ title: "Account Error", description: "Marketer profile not found. Please contact admin.", variant: "destructive" });
            navigate("/marketer");
            return;
        }
        setMarketer(mData);
        setLoading(false);
    };

    const copyReferralLink = () => {
        const link = `${window.location.origin}/register?ref=${marketer?.code}`;
        navigator.clipboard.writeText(link);
        toast({ title: "Link Copied!", description: "Share this link with potential members." });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!marketer) {
        return <div className="p-8 text-center text-muted-foreground">No marketer account found.</div>;
    }

    const referralLink = `${window.location.origin}/register?ref=${marketer.code}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/marketer">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Marketing Links</h1>
                    <p className="text-muted-foreground">Manage your unique referral links and codes.</p>
                </div>
            </div>

            <Card className="shadow-sm border-blue-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" /> Your Unique Referral Link
                    </CardTitle>
                    <CardDescription>Share this link to track new member registrations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-muted rounded-lg border">
                        <p className="flex-1 font-mono text-sm truncate">{referralLink}</p>
                        <Button onClick={copyReferralLink} size="sm" className="shrink-0">
                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        When someone registers using this link, they will be automatically associated with your marketer account.
                    </p>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" /> Your Referral QR Code
                    </CardTitle>
                    <CardDescription>Scan this QR code to quickly access your referral link.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center p-6">
                    {/* Placeholder for QR Code generation */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <QrCode className="h-32 w-32 text-gray-700" />
                        <p className="text-center text-xs text-muted-foreground mt-2">Scan to register</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}