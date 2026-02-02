import { SEO } from "@/components/SEO";

const PrivacyPolicy = () => {
  return (
    <>
      <SEO 
        title="Privacy Policy" 
        description="Privacy Policy for Command X - Learn how we collect, use, and protect your information."
      />
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Last updated: February 2, 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li><strong>Account information:</strong> Name, email address, phone number, company name</li>
                <li><strong>Employment information:</strong> Address, date of birth, photo</li>
                <li><strong>Government identification:</strong> Social Security Number (SSN) for tax and employment verification purposes</li>
                <li><strong>Financial information:</strong> Bank account details for direct deposit/payroll purposes</li>
                <li><strong>Business data:</strong> Customers, projects, estimates, invoices</li>
                <li><strong>Location data:</strong> Precise and background location (see Section 10)</li>
                <li><strong>Photos and documents:</strong> Identity documents, certifications, work-related photos</li>
                <li><strong>Communications:</strong> Messages you send through our platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process payroll and direct deposit transactions</li>
                <li>Verify employment eligibility and tax compliance</li>
                <li>Enable time tracking and geofencing features</li>
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
                <li>
                  <strong>Mapbox:</strong> We use Mapbox for map and location services. Location data may be 
                  processed by Mapbox for map rendering. For more information, see{" "}
                  <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Mapbox's Privacy Policy
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
                <li>Encryption of data in transit (TLS/SSL) and at rest</li>
                <li>Encryption of sensitive data such as SSN and bank account numbers</li>
                <li>Role-based access controls limiting who can view sensitive information</li>
                <li>Regular security assessments and penetration testing</li>
                <li>Secure data storage with row-level security policies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide 
                you services. Specific retention periods include:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li><strong>Account data:</strong> Retained while account is active and for 7 years after deletion for legal compliance</li>
                <li><strong>Tax-related data (SSN, W-9):</strong> Retained for 7 years per IRS requirements</li>
                <li><strong>Time tracking data:</strong> Retained for 3 years per labor law requirements</li>
                <li><strong>SMS consent records:</strong> Retained for at least 4 years to comply with TCPA requirements</li>
                <li><strong>Location data:</strong> Retained for 1 year for dispute resolution, then deleted</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                We will retain and use your information as necessary to comply with our legal obligations, 
                resolve disputes, and enforce our agreements.
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
                <li>Request deletion of your data (subject to legal retention requirements)</li>
                <li>Export your data in a portable format</li>
                <li>Opt-out of marketing communications</li>
                <li>Opt-out of SMS notifications by replying STOP</li>
                <li>Delete your account through the app settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Account Deletion</h2>
              <p className="text-muted-foreground">
                You may delete your account at any time through the app settings. Upon deletion:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Your personal data will be removed from active systems within 30 days</li>
                <li>Certain data may be retained for legal compliance (tax records, time entries)</li>
                <li>Anonymized data may be retained for analytics purposes</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                To request account deletion, navigate to Settings → Account → Delete Account, or contact 
                us at{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Command X is a workforce management application intended for use by adults (age 18 and older) 
                in a professional context. We do not knowingly collect personal information from children 
                under the age of 13. If we become aware that we have collected personal information from a 
                child under 13, we will take steps to delete such information promptly.
              </p>
              <p className="text-muted-foreground mt-3">
                If you believe we have inadvertently collected information from a child under 13, please 
                contact us immediately at{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Location Data Collection</h2>
              <p className="text-muted-foreground mb-3">
                <strong>Prominent Disclosure:</strong> Command X collects precise location data, including 
                background location data, to enable the following features:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li><strong>Automatic Clock-Out:</strong> When you leave a job site, the app automatically 
                records your departure time, even when the app is closed or not in use.</li>
                <li><strong>Geofencing:</strong> Location is used to verify you are at an authorized job 
                site when clocking in or out.</li>
                <li><strong>Time Tracking Verification:</strong> Location data provides audit trail for 
                time entries.</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                <strong>When location is collected:</strong> Location is only collected while you are 
                actively clocked in to a job site. When you clock out, background location tracking stops.
              </p>
              <p className="text-muted-foreground mt-3">
                <strong>How to disable:</strong> You can revoke location permissions at any time through 
                your device settings. Note that some features like auto clock-out will not function without 
                location access.
              </p>
              <p className="text-muted-foreground mt-3">
                <strong>Data sharing:</strong> Your location data is never shared with third parties for 
                advertising or marketing purposes. Location data is only used for the app functionality 
                described above.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of any changes 
                by posting the new policy on this page and updating the "Last updated" date. Material 
                changes will be communicated via email or in-app notification.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">12. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="mt-3 text-muted-foreground">
                <p><strong>Fairfield Resource Group</strong></p>
                <p>Email:{" "}
                  <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                    admin@fairfieldrg.com
                  </a>
                </p>
                <p>Address: 123 Business Center Drive, Suite 100, Dallas, TX 75001</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;