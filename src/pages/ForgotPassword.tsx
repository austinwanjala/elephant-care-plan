import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Send } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (error) throw error;

            setSuccess(true);
            toast({
                title: "Check your email",
                description: "We have sent a password reset link to your email address.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
            <div className="mx-auto w-full max-w-sm">
                <Link to="/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Reset Password</h1>
                    <p className="text-muted-foreground">Enter your email to receive recovery instructions.</p>
                </div>

                {!success ? (
                    <form onSubmit={handleReset} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="input-field"
                            />
                        </div>
                        <Button type="submit" className="w-full btn-primary" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Send Link</>}
                        </Button>
                    </form>
                ) : (
                    <div className="bg-green-50 text-green-800 p-4 rounded-lg text-center">
                        <p className="font-semibold mb-2">Check your inbox!</p>
                        <p className="text-sm">We've sent a password reset link to <span className="font-bold">{email}</span>.</p>
                        <Button variant="outline" className="mt-4 w-full" onClick={() => setSuccess(false)}>
                            Try another email
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
