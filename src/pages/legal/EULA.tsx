import { SEO } from "@/components/SEO";

const EULA = () => {
  return (
    <>
      <SEO 
        title="End User License Agreement" 
        description="End User License Agreement for Fairfield - Terms and conditions for using our software."
      />
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">End User License Agreement (EULA)</h1>
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. License Grant</h2>
              <p className="text-muted-foreground">
                Subject to the terms of this Agreement, Fairfield grants you a limited, non-exclusive, 
                non-transferable, revocable license to access and use our software application and 
                services for your internal business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Restrictions</h2>
              <p className="text-muted-foreground">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Copy, modify, or distribute the software</li>
                <li>Reverse engineer, decompile, or disassemble the software</li>
                <li>Rent, lease, or lend the software to third parties</li>
                <li>Use the software for any unlawful purpose</li>
                <li>Remove or alter any proprietary notices or labels</li>
                <li>Use automated systems to access the software in an unauthorized manner</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The software and all copies thereof are proprietary to Fairfield and title thereto 
                remains exclusively with Fairfield. All rights in the software not specifically 
                granted in this Agreement are reserved to Fairfield. The software is protected by 
                copyright and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Integrations</h2>
              <p className="text-muted-foreground">
                The software may integrate with third-party services, including but not limited to 
                Intuit QuickBooks. Your use of such integrations is subject to the respective 
                third-party terms of service and privacy policies. Fairfield is not responsible 
                for the availability, accuracy, or content of third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
                INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
                PARTICULAR PURPOSE, AND NONINFRINGEMENT. FAIRFIELD DOES NOT WARRANT THAT THE 
                SOFTWARE WILL BE UNINTERRUPTED OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                IN NO EVENT SHALL FAIRFIELD BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
                CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER 
                INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER 
                INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SOFTWARE.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Term and Termination</h2>
              <p className="text-muted-foreground">
                This Agreement is effective until terminated. Fairfield may terminate this Agreement 
                at any time if you fail to comply with any term of this Agreement. Upon termination, 
                you must cease all use of the software and destroy all copies in your possession.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Governing Law</h2>
              <p className="text-muted-foreground">
                This Agreement shall be governed by and construed in accordance with the laws of the 
                United States, without regard to its conflict of law provisions. Any disputes arising 
                under this Agreement shall be resolved in the courts of competent jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Changes to This Agreement</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify this Agreement at any time. We will provide notice of 
                significant changes by posting the updated Agreement on our website. Your continued 
                use of the software after such modifications constitutes your acceptance of the 
                updated Agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Agreement, please contact us at:{" "}
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

export default EULA;
