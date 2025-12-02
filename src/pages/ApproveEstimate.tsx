import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ApproveEstimate = () => {
  const { token } = useParams<{ token: string }>();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [approved, setApproved] = useState(false);

  // Fetch estimate by token using edge function (bypasses RLS)
  const { data: estimate, isLoading, error } = useQuery({
    queryKey: ["estimate-approval", token],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-estimate-for-approval", {
        body: { token },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const approveMutation = useMutation({
    mutationFn: async (action: "approve" | "request_changes") => {
      const { data, error } = await supabase.functions.invoke("approve-estimate", {
        body: { 
          token, 
          action,
          message: action === "request_changes" ? feedback : undefined
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, action) => {
      if (action === "approve") {
        setApproved(true);
        toast.success("Estimate approved successfully!");
      } else {
        toast.success("Your feedback has been submitted!");
        setShowFeedback(false);
        setFeedback("");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <XCircle className="w-6 h-6" />
              <CardTitle>Invalid Link</CardTitle>
            </div>
            <CardDescription>
              This approval link is invalid or has expired. Please contact us for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(estimate.valid_until) < new Date();
  const isAlreadyApproved = estimate.status === "approved";

  if (approved || isAlreadyApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle2 className="w-6 h-6" />
              <CardTitle>Estimate Approved!</CardTitle>
            </div>
            <CardDescription>
              Thank you for approving estimate #{estimate.number}. We'll be in touch soon to proceed with your project.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <XCircle className="w-6 h-6" />
              <CardTitle>Estimate Expired</CardTitle>
            </div>
            <CardDescription>
              This estimate expired on {new Date(estimate.valid_until).toLocaleDateString()}. Please contact us for an updated estimate.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
            <CardTitle className="text-2xl">Estimate #{estimate.number}</CardTitle>
            <CardDescription className="text-base">
              {estimate.project_name && `Project: ${estimate.project_name} • `}
              Valid until {new Date(estimate.valid_until).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Estimate Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-semibold text-sm">Description</th>
                    <th className="text-center py-3 px-2 font-semibold text-sm">Qty</th>
                    <th className="text-right py-3 px-2 font-semibold text-sm">Unit Price</th>
                    <th className="text-right py-3 px-2 font-semibold text-sm">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.estimate_line_items?.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-3 px-2 text-sm">{item.description}</td>
                      <td className="py-3 px-2 text-sm text-center">{item.quantity}</td>
                      <td className="py-3 px-2 text-sm text-right">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-3 px-2 text-sm text-right font-semibold">${Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-semibold">${Number(estimate.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({Number(estimate.tax_rate).toFixed(1)}%):</span>
                <span className="font-semibold">${Number(estimate.tax_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total:</span>
                <span className="text-primary">${Number(estimate.total).toFixed(2)}</span>
              </div>
            </div>

            {estimate.notes && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Notes:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{estimate.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        {!showFeedback ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={() => approveMutation.mutate("approve")}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending && approveMutation.variables === "approve" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve Estimate
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  size="lg"
                  onClick={() => setShowFeedback(true)}
                >
                  Request Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Request Changes</CardTitle>
              <CardDescription>
                Let us know what changes you'd like to see in this estimate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Please describe the changes you'd like..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => approveMutation.mutate("request_changes")}
                  disabled={!feedback.trim() || approveMutation.isPending}
                >
                  {approveMutation.isPending && approveMutation.variables === "request_changes" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFeedback(false);
                    setFeedback("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ApproveEstimate;
