import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
                <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. Information Collection</h2>
                    <p className="mb-4">
                        We collect personal information necessary to provide dental care services, including contact details, medical history, and payment information.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. Use of Information</h2>
                    <p className="mb-4">
                        Your information is used to:
                        <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li>Manage your membership and appointments</li>
                            <li>Process payments</li>
                            <li>Communicate important updates</li>
                            <li>Comply with legal and medical requirements</li>
                        </ul>
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. Data Security</h2>
                    <p className="mb-4">
                        We implement robust security measures to protect your personal data from unauthorized access, alteration, or disclosure.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. Third-Party Sharing</h2>
                    <p className="mb-4">
                        We do not sell your personal data. We may share data with trusted service providers who assist in our operations, under strict confidentiality agreements.
                    </p>
                </section>

                <p className="text-sm text-muted-foreground mt-8">
                    Last updated: {new Date().toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}
