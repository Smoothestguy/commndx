import { SEO } from "@/components/SEO";

const TermsOfService = () => {
  return (
    <>
      <SEO 
        title="Terms of Service" 
        description="Terms of Service for Fairfield - Review the terms and conditions for using our services."
      />
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using Fairfield's services, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground">
                Fairfield provides workforce management, contractor coordination, project management, 
                and related business services. Our platform enables businesses to manage personnel, 
                projects, estimates, invoices, and communications.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials 
                and for all activities that occur under your account. You agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Provide accurate and complete information when creating an account</li>
                <li>Update your information to keep it current</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Not share your account credentials with others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. SMS Terms and Conditions</h2>
              <p className="text-muted-foreground mb-3">
                By providing your phone number and consenting to receive SMS notifications, you agree to the following:
              </p>
              
              <h3 className="text-lg font-medium text-foreground mb-2">Consent to Receive Messages</h3>
              <p className="text-muted-foreground mb-3">
                You consent to receive SMS text messages from Fairfield regarding:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Contractor status and assignment updates</li>
                <li>Payment information and confirmations</li>
                <li>Application status updates</li>
                <li>Project-related notifications</li>
                <li>Scheduling and availability updates</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-2">Message Frequency</h3>
              <p className="text-muted-foreground mb-4">
                Message frequency varies. You may receive up to 5 messages per week depending on your 
                activity and notification preferences.
              </p>

              <h3 className="text-lg font-medium text-foreground mb-2">Costs</h3>
              <p className="text-muted-foreground mb-4">
                Message and data rates may apply. Check with your mobile carrier for details about 
                your text messaging plan.
              </p>

              <h3 className="text-lg font-medium text-foreground mb-2">Opt-Out</h3>
              <p className="text-muted-foreground mb-4">
                You may opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to 
                any message you receive from us. After opting out, you will receive a confirmation message 
                and will no longer receive SMS notifications. You may also contact us at{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>{" "}
                to update your preferences.
              </p>

              <h3 className="text-lg font-medium text-foreground mb-2">Help</h3>
              <p className="text-muted-foreground mb-4">
                For help, reply <strong>HELP</strong> to any message or contact us at{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>.
              </p>

              <h3 className="text-lg font-medium text-foreground mb-2">Privacy</h3>
              <p className="text-muted-foreground">
                Your mobile phone number and SMS consent information will not be shared with third parties 
                for promotional or marketing purposes. For more information, see our{" "}
                <a href="/legal/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Acceptable Use</h2>
              <p className="text-muted-foreground">
                You agree not to use our services to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the rights of others</li>
                <li>Upload malicious software or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with the proper functioning of our services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of our services are owned by Fairfield and are 
                protected by copyright, trademark, and other intellectual property laws. You may not 
                reproduce, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, Fairfield shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of our 
                services. Our total liability shall not exceed the amount you paid us in the twelve 
                months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Termination</h2>
              <p className="text-muted-foreground">
                We may terminate or suspend your account at any time for violations of these terms or 
                for any other reason at our sole discretion. Upon termination, your right to use our 
                services will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. We will notify you of significant 
                changes by posting a notice on our platform or sending you an email. Continued use of our 
                services after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Governing Law</h2>
              <p className="text-muted-foreground">
                These terms shall be governed by and construed in accordance with the laws of the State 
                of Texas, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us at:{" "}
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

export default TermsOfService;
