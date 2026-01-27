import { SEO } from "@/components/SEO";

const Copyright = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <>
      <SEO 
        title="Copyright Notice" 
        description="Copyright and intellectual property information for Command X by Fairfield."
      />
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Copyright Notice</h1>
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Copyright Ownership</h2>
              <p className="text-muted-foreground">
                © {currentYear} Fairfield. All rights reserved. Command X and all associated software, 
                documentation, graphics, logos, and other materials are the exclusive property of 
                Fairfield and are protected by United States and international copyright laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. All Rights Reserved</h2>
              <p className="text-muted-foreground">
                No part of this software, website, or any associated materials may be reproduced, 
                distributed, transmitted, displayed, published, or broadcast without the prior 
                written permission of Fairfield. You may not modify, create derivative works from, 
                or exploit any part of the materials except as expressly authorized.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Trademarks</h2>
              <p className="text-muted-foreground">
                The following are trademarks or registered trademarks of Fairfield:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Command X™</li>
                <li>Fairfield™</li>
                <li>The Command X logo and design</li>
                <li>The Fairfield logo and design</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                All other trademarks, service marks, and trade names referenced in our software or 
                materials are the property of their respective owners.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Permitted Uses</h2>
              <p className="text-muted-foreground">
                Subject to the terms of your license agreement, you may:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Access and use the software for your internal business purposes</li>
                <li>Print or download materials for personal, non-commercial reference</li>
                <li>Share links to our public pages</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                You may not:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Copy, reproduce, or duplicate the software or its components</li>
                <li>Sell, license, or distribute the software to third parties</li>
                <li>Remove or alter any copyright, trademark, or proprietary notices</li>
                <li>Use our trademarks without prior written authorization</li>
                <li>Reverse engineer, decompile, or disassemble the software</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. User-Generated Content</h2>
              <p className="text-muted-foreground">
                You retain ownership of any content you create, upload, or input into Command X 
                (such as customer data, project information, and documents). By using our services, 
                you grant Fairfield a limited license to store, process, and display your content 
                solely for the purpose of providing the services to you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Third-Party Content</h2>
              <p className="text-muted-foreground">
                Command X may integrate with or display content from third-party services. All 
                third-party content, trademarks, and materials remain the property of their 
                respective owners. Fairfield makes no claim of ownership over third-party content 
                and is not responsible for the accuracy or availability of such content.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. DMCA / Takedown Requests</h2>
              <p className="text-muted-foreground">
                Fairfield respects the intellectual property rights of others. If you believe that 
                your copyrighted work has been copied or used in a way that constitutes copyright 
                infringement, please provide us with the following information:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>A description of the copyrighted work you claim has been infringed</li>
                <li>A description of where the allegedly infringing material is located</li>
                <li>Your contact information (address, telephone number, email)</li>
                <li>A statement that you have a good faith belief the use is not authorized</li>
                <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act on behalf of the copyright owner</li>
                <li>Your physical or electronic signature</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Send DMCA notices to:{" "}
                <a href="mailto:admin@fairfieldrg.com" className="text-primary hover:underline">
                  admin@fairfieldrg.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about this Copyright Notice or to request permission for uses not 
                covered by your license agreement, please contact us at:{" "}
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

export default Copyright;
