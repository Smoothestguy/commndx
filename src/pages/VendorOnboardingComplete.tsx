import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { CheckCircle, Mail, Clock, CreditCard, FileText, FileSignature } from "lucide-react";

const VendorOnboardingComplete = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <SEO
        title="Vendor Registration Complete"
        description="Your vendor registration has been successfully completed"
      />

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="rounded-full bg-success/10 p-6 w-fit mx-auto mb-6 animate-in zoom-in duration-500">
            <CheckCircle className="h-16 w-16 text-success" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Registration Complete! 🎉</h1>
          <p className="text-lg text-muted-foreground">
            Your vendor registration has been successfully submitted.
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              What You've Completed
            </h2>
            <div className="space-y-4">
              {[
                { icon: FileText, title: "Company Information", desc: "Business details and contact information" },
                { icon: CreditCard, title: "Banking Details", desc: "Bank information for payment processing" },
                { icon: FileText, title: "W-9 Tax Form", desc: "Tax identification information submitted" },
                { icon: FileSignature, title: "Vendor Agreement", desc: "Vendor agreement reviewed and signed" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                  <Icon className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              What Happens Next
            </h2>
            <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
              <li className="pl-2">
                <span className="text-foreground font-medium">Review Process</span>
                <p className="text-sm ml-6 mt-1">Our team will review your submitted documents and information.</p>
              </li>
              <li className="pl-2">
                <span className="text-foreground font-medium">Approval</span>
                <p className="text-sm ml-6 mt-1">You'll be notified once your vendor account has been approved.</p>
              </li>
              <li className="pl-2">
                <span className="text-foreground font-medium">Portal Access</span>
                <p className="text-sm ml-6 mt-1">After approval, you'll receive credentials to access the vendor portal.</p>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                Questions? Contact the team that sent you the registration link for assistance.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">You may safely close this window.</p>
          <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
        </div>
      </div>
    </div>
  );
};

export default VendorOnboardingComplete;
