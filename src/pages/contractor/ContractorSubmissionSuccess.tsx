import React from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle, FileText, Receipt, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEO } from "@/components/SEO";

export default function ContractorSubmissionSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const submissionType = location.state?.type as "bill" | "expense" | undefined;

  const handleSubmitAnother = () => {
    navigate("/contractor");
  };

  return (
    <>
      <SEO
        title="Submission Successful"
        description="Your submission has been received"
      />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="container max-w-md mx-auto py-8 px-4">
          <Card className="shadow-lg">
            <CardContent className="pt-8 pb-8 text-center">
              {/* Success Icon */}
              <div className="mb-6 flex justify-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>

              {/* Success Message */}
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                Submission Received!
              </h1>
              <p className="text-muted-foreground mb-8">
                Your {submissionType === "expense" ? "expense" : "bill"} has been submitted successfully.
              </p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleSubmitAnother}
                  className="w-full gap-2"
                >
                  {submissionType === "expense" ? (
                    <Receipt className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Submit Another
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => navigate("/contractor")}
                  className="w-full gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Portal
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            Need to make changes? Contact your project manager.
          </p>
        </div>
      </div>
    </>
  );
}
