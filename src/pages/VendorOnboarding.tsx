import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useVendorOnboardingToken,
  useCompleteVendorOnboarding,
  type VendorOnboardingFormData,
} from "@/integrations/supabase/hooks/useVendorOnboarding";
import { VendorW9Form } from "@/components/vendors/onboarding/VendorW9Form";
import { VendorBankingForm } from "@/components/vendors/onboarding/VendorBankingForm";
import { VendorAgreementForm } from "@/components/vendors/onboarding/VendorAgreementForm";
import { VendorWorkAuthorizationForm } from "@/components/vendors/onboarding/VendorWorkAuthorizationForm";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  FileText,
  CreditCard,
  FileSignature,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Shield,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Company Info", icon: Building2 },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Work Auth", icon: Shield },
  { id: 4, title: "W-9 Tax Form", icon: FileText },
  { id: 5, title: "Banking", icon: CreditCard },
  { id: 6, title: "Agreement", icon: FileSignature },
  { id: 7, title: "Review", icon: CheckCircle },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY"
];

export default function VendorOnboarding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: validationResult, isLoading } = useVendorOnboardingToken(token);
  const completeOnboarding = useCompleteVendorOnboarding();

  const [currentStep, setCurrentStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Generate a session ID for document uploads
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const [formData, setFormData] = useState<VendorOnboardingFormData>({
    name: "", company: "", email: "", phone: "", contact_name: "", contact_title: "",
    business_type: "", years_in_business: "", website: "", specialty: "", license_number: "",
    address: "", city: "", state: "", zip: "", tax_id: "", track_1099: false,
    bank_name: "", bank_account_type: "", bank_routing_number: "", bank_account_number: "",
    w9_signature: null, vendor_agreement_signature: null, payment_terms: "net_30", billing_rate: "",
    insurance_expiry: "",
    citizenship_status: "", immigration_status: "", itin: "", documents: [],
  });

  // Initialize from vendor data
  if (validationResult?.vendor && !initialized) {
    const v = validationResult.vendor;
    setFormData((prev) => ({
      ...prev,
      name: v.name || "", company: v.company || "", email: v.email || "", phone: v.phone || "",
      contact_name: v.contact_name || "", specialty: v.specialty || "", license_number: v.license_number || "",
      address: v.address || "", city: v.city || "", state: v.state || "", zip: v.zip || "",
      tax_id: v.tax_id || "", track_1099: v.track_1099 || false,
      payment_terms: v.payment_terms || "net_30", billing_rate: v.billing_rate?.toString() || "",
    }));
    setInitialized(true);
  }

  const updateField = (field: keyof VendorOnboardingFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const progress = (currentStep / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.name.trim() !== "" && formData.email.trim() !== "";
      case 2: return true;
      case 3: {
        // Work authorization validation
        if (!formData.citizenship_status) return false;
        if (formData.citizenship_status === "us_citizen") {
          return formData.tax_id.replace(/\D/g, "").length === 9;
        }
        if (formData.citizenship_status === "non_us_citizen") {
          if (!formData.immigration_status) return false;
          if (formData.immigration_status === "other") {
            return formData.itin.replace(/\D/g, "").length === 9;
          }
          // visa, work_permit, green_card require TIN + documents
          const hasTin = formData.tax_id.replace(/\D/g, "").length === 9;
          if (formData.immigration_status === "green_card") {
            const hasFront = formData.documents?.some(d => d.type === "green_card_front");
            const hasBack = formData.documents?.some(d => d.type === "green_card_back");
            return hasTin && !!hasFront && !!hasBack;
          }
          const hasDoc = formData.documents?.some(d => d.type === formData.immigration_status);
          return hasTin && !!hasDoc;
        }
        return false;
      }
      case 4: return formData.tax_id.trim() !== "" && !!formData.w9_signature;
      case 5: return formData.bank_name !== "" && formData.bank_account_type !== "" && 
               formData.bank_routing_number.length === 9 && formData.bank_account_number.length >= 4;
      case 6: return !!formData.vendor_agreement_signature;
      case 7: return agreedToTerms;
      default: return true;
    }
  };

  const handleNext = () => { if (currentStep < STEPS.length && canProceed()) setCurrentStep((p) => p + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep((p) => p - 1); };

  const handleSubmit = async () => {
    if (!canProceed() || !validationResult?.token || !validationResult?.vendor) return;
    await completeOnboarding.mutateAsync({
      token: validationResult.token.token,
      vendorId: validationResult.vendor.id,
      formData,
    });
    navigate("/vendor-onboarding-complete", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Loading..." />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validating your link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validationResult?.isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Invalid Link" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
            <p className="text-muted-foreground">
              {validationResult?.isExpired ? "This link has expired." : validationResult?.isUsed ? "This link has already been used." : "This link is invalid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <SEO title="Complete Your Vendor Registration" />
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Vendor Registration</h1>
          <p className="text-muted-foreground">Welcome, {validationResult.vendor?.name}!</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;
              return (
                <div key={step.id} className={`flex flex-col items-center min-w-[50px] ${isActive ? "text-primary" : isComplete ? "text-success" : "text-muted-foreground"}`}>
                  <div className={`rounded-full p-2 mb-1 ${isActive ? "bg-primary text-primary-foreground" : isComplete ? "bg-success text-success-foreground" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step {currentStep}: {STEPS[currentStep - 1].title}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Company/Vendor Name *</Label><Input value={formData.name} onChange={(e) => updateField("name", e.target.value)} /></div>
                  <div><Label>DBA / Trade Name</Label><Input value={formData.company} onChange={(e) => updateField("company", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email *</Label><Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} /></div>
                  <div><Label>Phone</Label><Input value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Contact Name</Label><Input value={formData.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} /></div>
                  <div><Label>Contact Title</Label><Input value={formData.contact_title} onChange={(e) => updateField("contact_title", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Specialty</Label><Input value={formData.specialty} onChange={(e) => updateField("specialty", e.target.value)} /></div>
                  <div><Label>License Number</Label><Input value={formData.license_number} onChange={(e) => updateField("license_number", e.target.value)} /></div>
                </div>
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div><Label>Street Address</Label><Input value={formData.address} onChange={(e) => updateField("address", e.target.value)} /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>City</Label><Input value={formData.city} onChange={(e) => updateField("city", e.target.value)} /></div>
                  <div><Label>State</Label><Select value={formData.state} onValueChange={(v) => updateField("state", v)}><SelectTrigger><SelectValue placeholder="State" /></SelectTrigger><SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>ZIP</Label><Input value={formData.zip} onChange={(e) => updateField("zip", e.target.value)} /></div>
                </div>
              </div>
            )}
            {currentStep === 3 && <VendorWorkAuthorizationForm formData={formData} onUpdate={updateField} sessionId={sessionId} />}
            {currentStep === 4 && <VendorW9Form formData={formData} onUpdate={updateField} />}
            {currentStep === 5 && <VendorBankingForm formData={formData} onUpdate={updateField} />}
            {currentStep === 6 && <VendorAgreementForm vendorName={formData.name} signature={formData.vendor_agreement_signature} onUpdate={(sig) => updateField("vendor_agreement_signature", sig)} />}
            {currentStep === 7 && (
              <div className="space-y-4">
                <Alert><AlertDescription>Please review your information before submitting.</AlertDescription></Alert>
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(c) => setAgreedToTerms(c === true)} />
                  <Label htmlFor="terms">I confirm all information is accurate</Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}><ChevronLeft className="mr-2 h-4 w-4" />Back</Button>
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={!canProceed()}>Next<ChevronRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || completeOnboarding.isPending}>
              {completeOnboarding.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Registration"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
