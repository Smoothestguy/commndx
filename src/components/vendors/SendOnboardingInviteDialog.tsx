import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAddVendor } from "@/integrations/supabase/hooks/useVendors";
import {
  useSendVendorOnboardingInvitation,
  useSendVendorOnboardingSMS,
} from "@/integrations/supabase/hooks/useVendorOnboarding";
import { Loader2, ArrowLeft, ArrowRight, Send, Mail, MessageSquare } from "lucide-react";

interface SendOnboardingInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendOnboardingInviteDialog({
  open,
  onOpenChange,
}: SendOnboardingInviteDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "sms">("email");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addVendor = useAddVendor();
  const sendEmail = useSendVendorOnboardingInvitation();
  const sendSMS = useSendVendorOnboardingSMS();

  const resetForm = () => {
    setStep(1);
    setName("");
    setCompany("");
    setPhone("");
    setEmail("");
    setDeliveryMethod("email");
    setIsSubmitting(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const canProceed = name.trim() && phone.trim() && email.trim();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create vendor record with status 'invited'
      const newVendor = await addVendor.mutateAsync({
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        status: "active",
        vendor_type: "contractor",
        onboarding_status: "invited",
        specialty: null,
        insurance_expiry: null,
        license_number: null,
        w9_on_file: false,
        rating: null,
        user_id: null,
        onboarding_completed_at: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        tax_id: null,
        track_1099: false,
        billing_rate: null,
        payment_terms: null,
        account_number: null,
        default_expense_category_id: null,
        opening_balance: null,
        notes: null,
        bank_name: null,
        bank_account_type: null,
        bank_routing_number: null,
        bank_account_number: null,
        w9_signature: null,
        w9_signed_at: null,
        vendor_agreement_signature: null,
        vendor_agreement_signed_at: null,
        citizenship_status: null,
        immigration_status: null,
        itin: null,
        business_type: null,
        contact_name: null,
        contact_title: null,
        years_in_business: null,
        website: null,
      });

      if (!newVendor?.id) throw new Error("Failed to create vendor record");

      // Send invitation via selected method
      if (deliveryMethod === "email") {
        await sendEmail.mutateAsync({
          vendorId: newVendor.id,
          vendorName: name.trim(),
          email: email.trim(),
        });
      } else {
        await sendSMS.mutateAsync({
          vendorId: newVendor.id,
          vendorName: name.trim(),
          phone: phone.trim(),
        });
      }

      handleClose(false);
    } catch (error) {
      console.error("Error sending onboarding invite:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Onboarding Link
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Enter the vendor's basic information."
              : "Choose how to send the onboarding link."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full Name *</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-company">Company Name</Label>
              <Input
                id="invite-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-phone">Phone Number *</Label>
              <Input
                id="invite-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@company.com"
                required
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceed}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="font-medium">Name:</span> {name}</p>
              {company && <p><span className="font-medium">Company:</span> {company}</p>}
              <p><span className="font-medium">Phone:</span> {phone}</p>
              <p><span className="font-medium">Email:</span> {email}</p>
            </div>

            {/* Delivery method */}
            <div className="space-y-3">
              <Label>Send via</Label>
              <RadioGroup
                value={deliveryMethod}
                onValueChange={(v) => setDeliveryMethod(v as "email" | "sms")}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  htmlFor="method-email"
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    deliveryMethod === "email" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="email" id="method-email" />
                  <Mail className="h-4 w-4" />
                  <span className="text-sm font-medium">Email</span>
                </label>
                <label
                  htmlFor="method-sms"
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    deliveryMethod === "sms" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="sms" id="method-sms" />
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">SMS</span>
                </label>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
