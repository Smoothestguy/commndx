import { SEO } from "@/components/SEO";

const PrivacyPolicy = () => {
  return (
    <>
      <SEO 
        title="Privacy Policy" 
        description="Privacy Policy for Fairfield - Learn how we collect, use, and protect your information."
      />
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Account information (name, email address, company name)</li>
                <li>Business data (customers, projects, estimates, invoices)</li>
                <li>Payment and billing information</li>
                <li>Communications you send to us</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Protect against fraudulent or illegal activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. SMS Communications</h2>
              <p className="text-muted-foreground mb-3">
                When you provide your phone number and consent to SMS notifications, we collect and store:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Your mobile phone number</li>
                <li>The date and time of your consent</li>
                <li>The IP address from which consent was given</li>
                <li>The version of consent text you agreed to</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                We use this information to send you SMS notifications regarding contractor status updates, 
                payment information, application updates, and project-related communications.
              </p>
              <p className="text-muted-foreground mt-3">
                <strong>Opt-Out:</strong> To stop receiving SMS notifications, reply <strong>STOP</strong> to 
                any message. You may also contact us at{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>{" "}
                to update your preferences.
              </p>
              <p className="text-muted-foreground mt-3">
                <strong>Important:</strong> Your mobile phone number and SMS consent information will not be 
                shared with third parties for promotional or marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Services</h2>
              <p className="text-muted-foreground">
                Our application integrates with third-party services to provide enhanced functionality:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>
                  <strong>Twilio:</strong> We use Twilio to deliver SMS messages. Your phone number is 
                  shared with Twilio solely for the purpose of delivering notifications. Twilio does not 
                  use your information for marketing purposes. For more information, see{" "}
                  <a href="https://www.twilio.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Twilio's Privacy Policy
                  </a>.
                </li>
                <li>
                  <strong>Intuit QuickBooks:</strong> When you connect your QuickBooks account, we access 
                  your QuickBooks data (customers, products, invoices) to synchronize with our platform. 
                  Your QuickBooks credentials are never stored on our servers. We use OAuth 2.0 for secure 
                  authentication. For more information, see{" "}
                  <a href="https://www.intuit.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Intuit's Privacy Policy
                  </a>.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your personal 
                information against unauthorized access, alteration, disclosure, or destruction. This includes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments</li>
                <li>Access controls and authentication requirements</li>
                <li>Secure data storage practices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide 
                you services. We will retain and use your information as necessary to comply with our 
                legal obligations, resolve disputes, and enforce our agreements.
              </p>
              <p className="text-muted-foreground mt-3">
                SMS consent records are retained for at least 4 years to comply with TCPA requirements 
                and may be kept longer if required by applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt-out of marketing communications</li>
                <li>Opt-out of SMS notifications by replying STOP</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of any changes 
                by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy, please contact us at:{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
