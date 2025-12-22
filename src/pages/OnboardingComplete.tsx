import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { CheckCircle, Loader2, User, FileText, CreditCard, FileSignature, Mail, Clock } from "lucide-react";
import { format } from "date-fns";

const OnboardingComplete = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Fetch the personnel data using the token
  const { data: personnelData, isLoading } = useQuery({
    queryKey: ["onboarding-complete", token],
    queryFn: async () => {
      if (!token) return null;

      // Find the token record to get personnel_id
      const { data: tokenData, error: tokenError } = await supabase
        .from("personnel_onboarding_tokens")
        .select("personnel_id, used_at")
        .eq("token", token)
        .maybeSingle();

      if (tokenError || !tokenData) return null;

      // Fetch personnel details
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("first_name, last_name, email, onboarding_completed_at")
        .eq("id", tokenData.personnel_id)
        .maybeSingle();

      if (personnelError) return null;

      return {
        ...personnel,
        completedAt: tokenData.used_at || personnel?.onboarding_completed_at,
      };
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Loading..." description="Loading confirmation" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading your confirmation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <SEO 
        title="Onboarding Complete" 
        description="Your onboarding has been successfully completed" 
      />

      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="rounded-full bg-success/10 p-6 w-fit mx-auto mb-6 animate-in zoom-in duration-500">
            <CheckCircle className="h-16 w-16 text-success" />
          </div>
          <h1 className="text-3xl font-bold mb-3">
            Welcome Aboard{personnelData?.first_name ? `, ${personnelData.first_name}` : ""}! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            Your onboarding documentation has been successfully submitted.
          </p>
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              What You've Completed
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Personal Information</p>
                  <p className="text-sm text-muted-foreground">Your contact details and work authorization</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CreditCard className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Direct Deposit Setup</p>
                  <p className="text-sm text-muted-foreground">Bank information for payment processing</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <FileText className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">W-9 Tax Form</p>
                  <p className="text-sm text-muted-foreground">Tax identification information submitted</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <FileSignature className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Contractor Agreement</p>
                  <p className="text-sm text-muted-foreground">Independent contractor agreement signed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              What Happens Next
            </h2>
            
            <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
              <li className="pl-2">
                <span className="text-foreground font-medium">Review Process</span>
                <p className="text-sm ml-6 mt-1">Your supervisor will review your submitted documents and information.</p>
              </li>
              <li className="pl-2">
                <span className="text-foreground font-medium">Portal Access</span>
                <p className="text-sm ml-6 mt-1">You'll receive login credentials to access the personnel portal.</p>
              </li>
              <li className="pl-2">
                <span className="text-foreground font-medium">Work Assignment</span>
                <p className="text-sm ml-6 mt-1">Once verified, you'll be assigned to your projects.</p>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                Questions? Contact your supervisor or reach out to our HR team for assistance.
              </p>
            </div>
            
            {personnelData?.completedAt && (
              <p className="text-xs text-muted-foreground mt-4 text-center border-t pt-4">
                Submitted on {format(new Date(personnelData.completedAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Close Button */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">
            You may safely close this window.
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.close()}
          >
            Close Window
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingComplete;
