import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/register" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Registration
        </Link>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-serif font-bold mb-6">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: February 2024</p>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">1. Membership Eligibility</h2>
            <p>Membership in the Elephant Dental Care Plan is open to individuals who meet our registration criteria. By registering, you confirm that all information provided is accurate and complete.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">2. Coverage and Benefits</h2>
            <p>Our unique "2x Coverage" guarantee means that for every KES 500 contributed, you receive KES 1,000 in dental coverage. This coverage is valid at all authorized Elephant Dental branches.</p>
            <ul className="list-disc pl-6">
              <li>Benefits are non-transferable unless added as a registered dependant.</li>
              <li>Coverage is activated immediately upon successful payment.</li>
              <li>Unused balances may be subject to our rollover policy as defined in the system settings.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">3. Payment Terms</h2>
            <p>All contributions are processed via M-Pesa. You are responsible for ensuring that payments are made to the correct paybill number provided in the portal.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">4. Dependants</h2>
            <p>Members can add up to 5 dependants to their scheme. Dependants share the coverage balance of the primary member.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold">5. Termination</h2>
            <p>Elephant Dental reserves the right to terminate membership in cases of fraud, misrepresentation, or violation of these terms.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;