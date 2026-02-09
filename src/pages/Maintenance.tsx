import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Maintenance() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert className="h-10 w-10 text-amber-600" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-serif font-bold text-slate-900">System Maintenance</h1>
                    <p className="text-slate-600">
                        Elephant Dental is currently undergoing scheduled maintenance to improve our services.
                    </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-500 italic">
                    "We'll be back online shortly. Thank you for your patience."
                </div>
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                    Log Out
                </Button>
            </div>
        </div>
    );
}