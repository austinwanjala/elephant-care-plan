import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/register" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Registration
        </Link>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-serif font-bold mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: February 2024</p>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">1. Information We Collect</h2>
            <p>We collect personal information necessary to provide dental insurance services, including:</p>
            <ul className="list-disc pl-6">
              <li>Name, Email, and Phone Number</li>
              <li>National ID or Passport Number</li>
              <li>Age and Date of Birth</li>
              <li>Biometric data (for identity verification at branches)</li>
              <li>Dental health records and visit history</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">2. How We Use Your Information</h2>
            <p>Your data is used to manage your membership, process claims, verify your identity at our hospitals, and communicate important updates regarding your coverage.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">3. Data Sharing</h2>
            <p>We share your medical and membership information with our authorized branches to ensure you receive seamless care. We do not sell your personal data to third parties.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">4. Security</h2>
            <p>We implement robust security measures, including encryption and biometric authentication, to protect your sensitive information from unauthorized access.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">5. Your Rights</h2>
            <p>You have the right to access, correct, or request the deletion of your personal data. Please contact our support team for any privacy-related inquiries.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;