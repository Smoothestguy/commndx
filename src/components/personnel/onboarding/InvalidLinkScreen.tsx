import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SEO } from "@/components/SEO";
import { RequestNewLinkForm } from "./RequestNewLinkForm";
import { Clock, AlertTriangle, CheckCircle2, Mail, Phone } from "lucide-react";

interface InvalidLinkScreenProps {
  isExpired?: boolean;
  isUsed?: boolean;
}

export const InvalidLinkScreen = ({ isExpired, isUsed }: InvalidLinkScreenProps) => {
  const [showRequestForm, setShowRequestForm] = useState(false);

  const getIcon = () => {
    if (isExpired) return <Clock className="h-12 w-12 text-warning" />;
    if (isUsed) return <CheckCircle2 className="h-12 w-12 text-muted-foreground" />;
    return <AlertTriangle className="h-12 w-12 text-warning" />;
  };

  const getTitle = () => {
    if (isExpired) return "Link Expired";
    if (isUsed) return "Link Already Used";
    return "Invalid Link";
  };

  const getMessage = () => {
    if (isExpired) {
      return "This onboarding link has expired. Don't worry - you can request a new link below.";
    }
    if (isUsed) {
      return "This onboarding link has already been used. If you need to update your information, please contact your supervisor.";
    }
    return "This onboarding link is not valid. Please check your email for the correct link or request a new one below.";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO title={getTitle()} description="This onboarding link is invalid" />
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          {showRequestForm ? (
            <RequestNewLinkForm onBack={() => setShowRequestForm(false)} />
          ) : (
            <div className="text-center space-y-4">
              <div className="rounded-full bg-muted p-4 w-fit mx-auto">
                {getIcon()}
              </div>
              
              <h2 className="text-xl font-bold">{getTitle()}</h2>
              
              <p className="text-muted-foreground">{getMessage()}</p>

              {/* Action buttons - only show request form for expired/invalid, not for used */}
              {!isUsed && (
                <Button 
                  onClick={() => setShowRequestForm(true)}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Request New Link
                </Button>
              )}

              <Separator className="my-4" />

              {/* Contact info section */}
              <div className="text-left space-y-3 bg-muted/50 rounded-lg p-4">
                <h3 className="font-medium text-sm">Need help?</h3>
                <p className="text-sm text-muted-foreground">
                  If you're having trouble, contact your supervisor or our support team:
                </p>
                <div className="space-y-2">
                  <a 
                    href="mailto:support@fairfieldrg.com" 
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    support@fairfieldrg.com
                  </a>
                  <a 
                    href="tel:+18005551234" 
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    (800) 555-1234
                  </a>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
