import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, Mail } from "lucide-react";

interface RequestNewLinkFormProps {
  onBack: () => void;
}

export const RequestNewLinkForm = ({ onBack }: RequestNewLinkFormProps) => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "resend-onboarding-link",
        {
          body: { email: email.trim() },
        }
      );

      if (fnError) {
        console.error("Error requesting new link:", fnError);
        setError("Failed to send request. Please try again later.");
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Error:", err);
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded-full bg-success/10 p-4 w-fit mx-auto">
          <CheckCircle className="h-12 w-12 text-success" />
        </div>
        <h3 className="text-lg font-semibold">Check Your Email</h3>
        <p className="text-muted-foreground text-sm">
          If an account exists with this email address, you'll receive a new
          onboarding link within a few minutes.
        </p>
        <p className="text-muted-foreground text-sm">
          Don't see it? Check your spam folder or contact your supervisor.
        </p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <div className="rounded-full bg-primary/10 p-3 w-fit mx-auto mb-3">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Request New Link</h3>
        <p className="text-muted-foreground text-sm">
          Enter your email address and we'll send you a new onboarding link.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="request-email">Email Address</Label>
        <Input
          id="request-email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          autoComplete="email"
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send New Link"
          )}
        </Button>
      </div>
    </form>
  );
};
