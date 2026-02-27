import React from "react";
import { LegalLayout } from "@/components/LegalLayout";

const PrivacyPolicy = () => {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How we protect and manage your sensitive health data"
    >
      <section>
        <h2>1. Privacy Commitment</h2>
        <p>
          At <strong>Elephant Dental</strong>, your privacy is our priority. This policy outlines how we collect, use, and safeguard your personal and medical information in compliance with the **Data Protection Act of Kenya**.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>
          We collect information that helps us provide quality dental care and manage your insurance wallet:
        </p>
        <ul>
          <li><strong>Identity Data:</strong> Name, ID Number, Gender, and Date of Birth.</li>
          <li><strong>Contact Data:</strong> Phone number and email address for notifications and STK Push payments.</li>
          <li><strong>Health Data:</strong> Dental history, allergies, and treatment records.</li>
          <li><strong>Financial Data:</strong> Transaction references from M-Pesa (we do not store your M-Pesa PIN).</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Data</h2>
        <p>
          Your data is used solely for:
        </p>
        <ul>
          <li>Processing your 2x coverage contributions.</li>
          <li>Verifying your identity at our hospitals via QR Code.</li>
          <li>Maintaining accurate clinical records for your dental health.</li>
          <li>Sending you reminders for checkups and payment confirmations.</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Sharing and Disclosure</h2>
        <p>
          We **never** sell your personal or health data to third-party advertisers.
          Information is only shared with:
        </p>
        <ul>
          <li>Your selected dentist or specialist within the Elephant Dental network.</li>
          <li>Regulatory bodies when required by Kenyan Law.</li>
          <li>Payment processors (KopoKopo/Safaricom) to facilitate transactions.</li>
        </ul>
      </section>

      <section>
        <h2>5. Data Security</h2>
        <p>
          We implement enterprise-grade encryption for all sensitive data. Your digital insurance card and treatment history are stored in secure cloud environments (Supabase/PostgreSQL) with strict role-based access controls.
        </p>
      </section>

      <section>
        <h2>6. Your Rights</h2>
        <p>
          Under the Data Protection Act, you have the right to:
        </p>
        <ul>
          <li>Request a copy of your dental records.</li>
          <li>Correct any inaccurate personal information.</li>
          <li>Request deletion of your account (subject to medical record retention laws).</li>
          <li>Opt-out of marketing communications.</li>
        </ul>
      </section>

      <section>
        <h2>7. Cookies and Tracking</h2>
        <p>
          Our web portal uses essential cookies to keep you logged in and personalise your dashboard. We do not use intrusive tracking cookies.
        </p>
      </section>

      <section>
        <h2>8. Updates to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Significant changes will be communicated via SMS or through your member portal.
        </p>
      </section>
    </LegalLayout>
  );
};

export default PrivacyPolicy;
