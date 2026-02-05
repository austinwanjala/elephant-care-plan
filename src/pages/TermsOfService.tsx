import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-6">
                <Link to="/register">
                    <Button variant="ghost" className="gap-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Registration
                    </Button>
                </Link>
            </div>

            <div className="prose dark:prose-invert max-w-none">
                <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                    <p className="mb-4">
                        Welcome to Elephant Dental. By accessing our website and using our services, you agree to comply with and be bound by the following terms and conditions.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. Membership</h2>
                    <p className="mb-4">
                        Membership is subject to approval and payment of applicable fees. Benefits are non-transferable unless explicitly stated in your plan.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. Medical Services</h2>
                    <p className="mb-4">
                        All medical services are provided by qualified professionals. We reserve the right to refuse service if safety protocols are not followed.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. Payments and Refunds</h2>
                    <p className="mb-4">
                        Payments for membership and services are due upon receipt. Refund policies are determined by the specific terms of your chosen membership scheme.
                    </p>
                </section>

                <p className="text-sm text-muted-foreground mt-8">
                    Last updated: {new Date().toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}
