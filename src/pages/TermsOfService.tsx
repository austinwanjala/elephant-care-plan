import React from "react";
import { LegalLayout } from "@/components/LegalLayout";

const TermsOfService = () => {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The details of our commitment to your oral health"
    >
      <section>
        <h2>1. Introduction</h2>
        <p>
          Welcome to <strong>Elephant Dental</strong>. These Terms of Service ("Terms") govern your participation in our dental insurance and contribution scheme.
          By registering an account, making a payment, or using our dental services, you agree to be bound by these Terms.
        </p>
      </section>

      <section>
        <h2>2. Member Eligibility</h2>
        <p>
          To be a member of the Elephant Dental Scheme, you must:
        </p>
        <ul>
          <li>Be a resident of Kenya with a valid Identification Document.</li>
          <li>Be at least 18 years of age (guardians may register dependants under 18).</li>
          <li>Provide accurate and truthful personal information during registration.</li>
        </ul>
      </section>

      <section>
        <h2>3. The 2x Coverage Policy</h2>
        <p>
          Elephant Dental provides a unique **Contribution Doubling** benefit:
        </p>
        <ul>
          <li>The minimum contribution amount is <strong>KES 500</strong>.</li>
          <li>For every contribution approved via our M-Pesa gateway, Elephant Dental will credit your health wallet with <strong>double</strong> the amount paid.</li>
          <li>For example, a payment of KES 500 grants you KES 1,000 in dental service coverage.</li>
          <li>This coverage is strictly for dental procedures performed at certified Elephant Dental branches.</li>
        </ul>
      </section>

      <section>
        <h2>4. Payments and Refunds</h2>
        <p>
          All payments must be made through our official M-Pesa integration. Manual payments to individual staff members are strictly prohibited.
          Contributions are non-refundable as they are immediately applied to your coverage limit.
          Coverage credits cannot be converted back to cash.
        </p>
      </section>

      <section>
        <h2>5. Visit and Claims Process</h2>
        <p>
          To access services, members must present their digital insurance card (QR Code) at any branch.
          The cost of the procedure will be deducted from your available coverage balance. If the procedure cost exceeds your balance, the difference must be paid at the reception.
        </p>
      </section>

      <section>
        <h2>6. Termination of Membership</h2>
        <p>
          Elephant Dental reserves the right to suspend or terminate membership in cases of fraudulent claims, identity theft, or violation of these terms.
          Members may choose to stop contributions at any time without penalty, though accumulated credits will remain subject to expiration policies (if applicable).
        </p>
      </section>

      <section>
        <h2>7. Limitation of Liability</h2>
        <p>
          While we strive for excellence, Elephant Dental's liability is limited to the provision of dental services up to the limit of your available coverage.
          We are not responsible for delays caused by network failures during payment processing.
        </p>
      </section>

      <section>
        <h2>8. Contact Information</h2>
        <p>
          For any clarifications regarding these terms, please contact our Legal Department at:
          <br />
          <strong>Email:</strong> legal@elephantdental.org
          <br />
          <strong>Phone:</strong> +254 710 500 500
        </p>
      </section>
    </LegalLayout>
  );
};

export default TermsOfService;
