import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";
import { EmergencyContactForm } from "@/components/personnel/registration/EmergencyContactForm";
import { SSNInput } from "@/components/personnel/registration/SSNInput";
import { ITINInput } from "@/components/personnel/registration/ITINInput";
import { CategoryDocumentUpload } from "@/components/personnel/registration/CategoryDocumentUpload";
import { DirectDepositForm } from "@/components/personnel/onboarding/DirectDepositForm";
import { W9TaxForm } from "@/components/personnel/onboarding/W9TaxForm";
import { ContractorAgreementForm } from "@/components/personnel/onboarding/ContractorAgreementForm";
import { InvalidLinkScreen } from "@/components/personnel/onboarding/InvalidLinkScreen";
import {
  useOnboardingToken,
  useCompleteOnboarding,
  type OnboardingFormData,
} from "@/integrations/supabase/hooks/usePersonnelOnboarding";
import type {
  EmergencyContact,
  RegistrationDocument,
  CitizenshipStatus,
  ImmigrationStatus,
} from "@/integrations/supabase/hooks/usePersonnelRegistrations";
import {
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Shield,
  Users,
  CheckCircle,
  Loader2,
  Info,
  AlertTriangle,
  CreditCard,
  FileText,
  FileSignature,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Work Authorization", icon: Shield },
  { id: 4, title: "Direct Deposit", icon: CreditCard },
  { id: 5, title: "W-9 Tax Form", icon: FileText },
  { id: 6, title: "Contractor Agreement", icon: FileSignature },
  { id: 7, title: "Emergency Contacts", icon: Users },
  { id: 8, title: "Review & Submit", icon: CheckCircle },
];

const IMMIGRATION_STATUS_OPTIONS = [
  { value: "visa", label: "Visa" },
  { value: "work_permit", label: "Work Permit (EAD - Employment Authorization Document)" },
  { value: "green_card", label: "Green Card (Permanent Resident)" },
  { value: "other", label: "Other" },
];

const CITIZENSHIP_LABELS: Record<string, string> = {
  us_citizen: "U.S. Citizen",
  non_us_citizen: "Non-U.S. Citizen",
};

const IMMIGRATION_LABELS: Record<string, string> = {
  visa: "Visa",
  work_permit: "Work Permit (EAD)",
  green_card: "Green Card",
  other: "Other",
};

const TAX_CLASSIFICATION_LABELS: Record<string, string> = {
  individual: "Individual/sole proprietor",
  c_corporation: "C Corporation",
  s_corporation: "S Corporation",
  partnership: "Partnership",
  trust_estate: "Trust/estate",
  llc_c: "LLC (C Corp)",
  llc_s: "LLC (S Corp)",
  llc_p: "LLC (Partnership)",
};

// Extended form data to include new fields
interface ExtendedOnboardingFormData extends OnboardingFormData {
  itin: string;
  bank_name: string;
  bank_account_type: string;
  bank_routing_number: string;
  bank_account_number: string;
  direct_deposit_signature: string | null;
  tax_classification: string;
  tax_ein: string;
  tax_business_name: string;
  w9_signature: string | null;
  w9_certification: boolean;
  ica_signature: string | null;
}

const PersonnelOnboarding = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const { data: validationResult, isLoading, error } = useOnboardingToken(token);
  const completeOnboarding = useCompleteOnboarding();

  // Generate a session ID for document uploads
  const sessionId = useMemo(
    () => `onboard-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    []
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Cache validation data to prevent loss during React Query refetches
  const [cachedValidation, setCachedValidation] = useState<{
    token: NonNullable<typeof validationResult>["token"];
    personnel: NonNullable<typeof validationResult>["personnel"];
  } | null>(null);

  // Update cached data when validation result is available
  useEffect(() => {
    if (validationResult?.isValid && validationResult?.token && validationResult?.personnel) {
      setCachedValidation({
        token: validationResult.token,
        personnel: validationResult.personnel,
      });
    }
  }, [validationResult?.isValid, validationResult?.token, validationResult?.personnel]);

  // Initialize form data from personnel record
  const [formData, setFormData] = useState<ExtendedOnboardingFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    photo_url: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    ssn_full: "",
    itin: "",
    citizenship_status: undefined,
    immigration_status: undefined,
    emergency_contacts: [],
    documents: [],
    // New fields
    bank_name: "",
    bank_account_type: "",
    bank_routing_number: "",
    bank_account_number: "",
    direct_deposit_signature: null,
    tax_classification: "",
    tax_ein: "",
    tax_business_name: "",
    w9_signature: null,
    w9_certification: false,
    ica_signature: null,
  });

  // Sync form data when personnel data loads
  const [initialized, setInitialized] = useState(false);
  if (validationResult?.personnel && !initialized) {
    const p = validationResult.personnel;
    setFormData((prev) => ({
      ...prev,
      first_name: p.first_name || prev.first_name,
      last_name: p.last_name || prev.last_name,
      email: p.email || prev.email,
      phone: p.phone || prev.phone,
      date_of_birth: p.date_of_birth || prev.date_of_birth,
      photo_url: p.photo_url || prev.photo_url,
      address: p.address || prev.address,
      city: p.city || prev.city,
      state: p.state || prev.state,
      zip: p.zip || prev.zip,
    }));
    setInitialized(true);
  }

  const updateField = (field: keyof ExtendedOnboardingFormData, value: string | boolean | CitizenshipStatus | ImmigrationStatus | undefined | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to get document by type
  const getDocumentByType = (docType: RegistrationDocument["document_type"]) => {
    return formData.documents.find((d) => d.document_type === docType);
  };

  // Helper to add/update document
  const handleDocumentUpload = (doc: RegistrationDocument) => {
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents.filter((d) => d.document_type !== doc.document_type), doc],
    }));
  };

  // Helper to remove document by type
  const handleDocumentRemove = (docType: RegistrationDocument["document_type"]) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.document_type !== docType),
    }));
  };

  const progress = (currentStep / STEPS.length) * 100;

  // Helper to check if a document passed AI verification (or wasn't verified)
  const isDocumentVerified = (docType: RegistrationDocument["document_type"]): boolean => {
    const doc = getDocumentByType(docType);
    if (!doc) return false;
    
    // Check if document has verification result
    const verification = (doc as any).verification;
    if (!verification) {
      // No verification performed (e.g., PDF files) - allow but note it
      return true;
    }
    
    // Must be verified (high or medium confidence acceptable)
    return verification.verified === true;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          formData.first_name.trim() !== "" &&
          formData.last_name.trim() !== "" &&
          formData.email.trim() !== ""
        );
      case 2:
        return true; // Address is optional
      case 3: {
        // Citizenship status is always required
        if (!formData.citizenship_status) return false;

        // Citizenship-specific requirements
        if (formData.citizenship_status === "us_citizen") {
          // US Citizen: SSN + Government ID required
          const hasSSN = formData.ssn_full && formData.ssn_full.length === 9;
          const hasGovtId = !!getDocumentByType("government_id");
          return hasSSN && hasGovtId && isDocumentVerified("government_id");
        } else {
          // Non-US citizen needs immigration status
          if (!formData.immigration_status) return false;

          // For visa, work_permit, green_card: SSN required
          // For other: ITIN required
          if (formData.immigration_status === "other") {
            const hasITIN = formData.itin && formData.itin.length === 9 && formData.itin.startsWith("9");
            // Work authorization document is optional
            return hasITIN;
          } else {
            // Visa, Work Permit, Green Card all need SSN
            const hasSSN = formData.ssn_full && formData.ssn_full.length === 9;
            if (!hasSSN) return false;

            switch (formData.immigration_status) {
              case "visa":
                return !!getDocumentByType("visa");
              case "work_permit":
                return !!getDocumentByType("work_permit");
              case "green_card":
                return !!getDocumentByType("green_card_front") && !!getDocumentByType("green_card_back");
              default:
                return false;
            }
          }
        }
      }
      case 4: {
        // Direct Deposit: bank info and signature required
        return (
          formData.bank_name.trim() !== "" &&
          formData.bank_account_type !== "" &&
          formData.bank_routing_number.length === 9 &&
          formData.bank_account_number.length >= 4 &&
          !!formData.direct_deposit_signature
        );
      }
      case 5: {
        // W-9: classification, certification, and signature required
        const needsEIN = formData.tax_classification && !["individual"].includes(formData.tax_classification);
        const hasEIN = !needsEIN || (formData.tax_ein && formData.tax_ein.length >= 9);
        return (
          formData.tax_classification !== "" &&
          formData.w9_certification &&
          !!formData.w9_signature &&
          hasEIN
        );
      }
      case 6: {
        // ICA: signature required
        return !!formData.ica_signature;
      }
      case 7:
        return (
          formData.emergency_contacts.length > 0 &&
          formData.emergency_contacts.every(
            (c) =>
              c.name.trim() !== "" &&
              c.relationship.trim() !== "" &&
              c.phone.trim() !== ""
          )
        );
      case 8:
        return agreedToTerms;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length && canProceed()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Use cached validation data if current query data is unavailable (handles refetch states)
    const tokenData = validationResult?.token || cachedValidation?.token;
    const personnelData = validationResult?.personnel || cachedValidation?.personnel;

    // Validate session is still active
    if (!tokenData || !personnelData) {
      if (isLoading) {
        toast.error("Please wait while we verify your session...");
      } else {
        toast.error("Unable to verify your session. Please refresh the page and try again.");
      }
      return;
    }

    // Check if token is actually expired (not just query state)
    if (tokenData.expires_at) {
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        toast.error("Your onboarding link has expired. Please request a new one.");
        return;
      }
    }

    if (!canProceed()) {
      toast.error("Please complete all required fields before submitting.");
      return;
    }

    try {
      await completeOnboarding.mutateAsync({
        token: tokenData.token,
        personnelId: personnelData.id,
        formData: formData as OnboardingFormData,
        // Pass extended fields separately
        bankName: formData.bank_name,
        bankAccountType: formData.bank_account_type,
        bankRoutingNumber: formData.bank_routing_number,
        bankAccountNumber: formData.bank_account_number,
        directDepositSignature: formData.direct_deposit_signature,
        taxClassification: formData.tax_classification,
        taxEin: formData.tax_ein,
        taxBusinessName: formData.tax_business_name,
        w9Signature: formData.w9_signature,
        w9Certification: formData.w9_certification,
        icaSignature: formData.ica_signature,
      });
      
      // Redirect to personalized thank you page
      navigate(`/onboarding-complete/${token}`, { replace: true });
    } catch (error) {
      console.error("[Onboarding] Submit error:", error);
      // The mutation's onError handler shows a toast, but add fallback
      if (error instanceof Error && !error.message.includes("toast")) {
        toast.error("Failed to complete onboarding. Please try again.");
      }
    }
  };

  // Token expiration warning
  useEffect(() => {
    if (!validationResult?.token?.expires_at) return;
    
    const expiresAt = new Date(validationResult.token.expires_at);
    const warningTime = 30 * 60 * 1000; // 30 minutes before expiry
    const now = new Date();
    
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const timeUntilWarning = timeUntilExpiry - warningTime;
    
    // Already expired or within warning window
    if (timeUntilExpiry <= 0) {
      toast.error("Your onboarding link has expired. Please request a new one.");
      return;
    }
    
    if (timeUntilWarning <= 0) {
      const minutesLeft = Math.ceil(timeUntilExpiry / 60000);
      toast.warning(`Your session will expire in ${minutesLeft} minutes. Please complete and submit the form soon.`);
      return;
    }
    
    const timer = setTimeout(() => {
      const minutesLeft = Math.ceil(warningTime / 60000);
      toast.warning(`Your session will expire in about ${minutesLeft} minutes. Please complete and submit the form soon.`);
    }, timeUntilWarning);
    
    return () => clearTimeout(timer);
  }, [validationResult?.token?.expires_at]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Loading..." description="Loading onboarding form" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validating your onboarding link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Error" description="An error occurred" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-destructive/10 p-4 w-fit mx-auto mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't load your onboarding form. Please try again or contact support.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/expired/used token - use dedicated screen with request new link
  if (!validationResult?.isValid) {
    return (
      <InvalidLinkScreen 
        isExpired={validationResult?.isExpired} 
        isUsed={validationResult?.isUsed} 
      />
    );
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return "Verify your personal information";
      case 2: return "Provide your current address";
      case 3: return "Share your work authorization details and upload documents";
      case 4: return "Set up your direct deposit for payments";
      case 5: return "Complete your W-9 tax form for tax reporting";
      case 6: return "Review and sign the Independent Contractor Agreement";
      case 7: return "Add at least one emergency contact";
      case 8: return "Review your information and submit";
      default: return "";
    }
  };

  // Main form
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <SEO
        title="Complete Your Onboarding"
        description="Complete your personnel onboarding documentation"
      />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Your Onboarding</h1>
          <p className="text-muted-foreground">
            Welcome, {validationResult.personnel?.first_name}! Please complete the form below.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2 overflow-x-auto">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center min-w-[60px] ${
                    isActive
                      ? "text-primary"
                      : isComplete
                        ? "text-success"
                        : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`rounded-full p-2 mb-1 ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isComplete
                          ? "bg-success text-success-foreground"
                          : "bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs hidden sm:block text-center">{step.title}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = STEPS[currentStep - 1].icon;
                return <Icon className="h-5 w-5" />;
              })()}
              Step {currentStep}: {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{getStepDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => updateField("first_name", e.target.value)}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => updateField("date_of_birth", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Address */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="Austin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => updateField("state", e.target.value)}
                      placeholder="TX"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                    placeholder="78701"
                    maxLength={10}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Work Authorization */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This information is required for employment verification. All documents will be securely stored.
                  </AlertDescription>
                </Alert>

                {/* Citizenship Status - FIRST */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Citizenship Status
                  </h3>
                  
                  <div className="space-y-2">
                    <Label>Are you a U.S. Citizen? *</Label>
                    <RadioGroup
                      value={formData.citizenship_status || ""}
                      onValueChange={(value) => {
                        updateField("citizenship_status", value as CitizenshipStatus);
                        if (value === "us_citizen") {
                          updateField("immigration_status", undefined);
                          updateField("itin", "");
                        } else {
                          updateField("ssn_full", "");
                        }
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="us_citizen" id="us_citizen" />
                        <Label htmlFor="us_citizen" className="cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="non_us_citizen" id="non_us_citizen" />
                        <Label htmlFor="non_us_citizen" className="cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                {/* US Citizen: SSN + Government ID */}
                {formData.citizenship_status === "us_citizen" && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Identification
                    </h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="ssn_full">Social Security Number *</Label>
                      <SSNInput
                        value={formData.ssn_full || ""}
                        onChange={(value) => updateField("ssn_full", value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Required for employment verification
                      </p>
                    </div>

                    <CategoryDocumentUpload
                      documentType="government_id"
                      label="Government ID (Driver's License or Passport) *"
                      helperText="Upload a clear image of your ID"
                      required
                      existingDocument={getDocumentByType("government_id")}
                      onUpload={handleDocumentUpload}
                      onRemove={() => handleDocumentRemove("government_id")}
                      sessionId={sessionId}
                    />
                  </div>
                )}

                {/* Non-US Citizen: Immigration Status selection */}
                {formData.citizenship_status === "non_us_citizen" && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <div className="space-y-2">
                      <Label>Immigration Status *</Label>
                      <RadioGroup
                        value={formData.immigration_status || ""}
                        onValueChange={(value) => {
                          updateField("immigration_status", value as ImmigrationStatus);
                          // Clear SSN/ITIN when switching status
                          if (value === "other") {
                            updateField("ssn_full", "");
                          } else {
                            updateField("itin", "");
                          }
                        }}
                        className="grid gap-2"
                      >
                        {IMMIGRATION_STATUS_OPTIONS.map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={option.value} id={option.value} />
                            <Label htmlFor={option.value} className="cursor-pointer">{option.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    {/* Visa: SSN + Visa Document */}
                    {formData.immigration_status === "visa" && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="ssn_full">Social Security Number *</Label>
                          <SSNInput
                            value={formData.ssn_full || ""}
                            onChange={(value) => updateField("ssn_full", value)}
                            required
                          />
                        </div>
                        <CategoryDocumentUpload
                          documentType="visa"
                          label="Visa Document *"
                          helperText="Upload your visa stamp or I-94"
                          required
                          existingDocument={getDocumentByType("visa")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("visa")}
                          sessionId={sessionId}
                        />
                      </div>
                    )}

                    {/* Work Permit: SSN + EAD */}
                    {formData.immigration_status === "work_permit" && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="ssn_full">Social Security Number *</Label>
                          <SSNInput
                            value={formData.ssn_full || ""}
                            onChange={(value) => updateField("ssn_full", value)}
                            required
                          />
                        </div>
                        <CategoryDocumentUpload
                          documentType="work_permit"
                          label="Employment Authorization Document (EAD) *"
                          helperText="Upload your EAD card"
                          required
                          existingDocument={getDocumentByType("work_permit")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("work_permit")}
                          sessionId={sessionId}
                        />
                      </div>
                    )}

                    {/* Green Card: SSN + Front & Back */}
                    {formData.immigration_status === "green_card" && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="ssn_full">Social Security Number *</Label>
                          <SSNInput
                            value={formData.ssn_full || ""}
                            onChange={(value) => updateField("ssn_full", value)}
                            required
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <CategoryDocumentUpload
                            documentType="green_card_front"
                            label="Green Card (Front) *"
                            helperText="Upload the front of your Green Card"
                            required
                            existingDocument={getDocumentByType("green_card_front")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("green_card_front")}
                            sessionId={sessionId}
                          />
                          <CategoryDocumentUpload
                            documentType="green_card_back"
                            label="Green Card (Back) *"
                            helperText="Upload the back of your Green Card"
                            required
                            existingDocument={getDocumentByType("green_card_back")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("green_card_back")}
                            sessionId={sessionId}
                          />
                        </div>
                      </div>
                    )}

                    {/* Other: ITIN + Work Authorization Document */}
                    {formData.immigration_status === "other" && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="itin">Individual Taxpayer Identification Number (ITIN) *</Label>
                          <ITINInput
                            value={formData.itin || ""}
                            onChange={(value) => updateField("itin", value)}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            ITIN must be 9 digits and start with 9
                          </p>
                        </div>
                        <CategoryDocumentUpload
                          documentType="other"
                          label="Work Authorization Document *"
                          helperText="Upload your work authorization documentation"
                          required
                          existingDocument={getDocumentByType("other")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("other")}
                          sessionId={sessionId}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Direct Deposit */}
            {currentStep === 4 && (
              <DirectDepositForm
                data={{
                  bank_name: formData.bank_name,
                  bank_account_type: formData.bank_account_type,
                  bank_routing_number: formData.bank_routing_number,
                  bank_account_number: formData.bank_account_number,
                  direct_deposit_signature: formData.direct_deposit_signature,
                }}
                onChange={(field, value) => updateField(field as keyof ExtendedOnboardingFormData, value)}
                personnelName={`${formData.first_name} ${formData.last_name}`}
              />
            )}

            {/* Step 5: W-9 Tax Form */}
            {currentStep === 5 && (
              <W9TaxForm
                data={{
                  tax_classification: formData.tax_classification,
                  tax_ein: formData.tax_ein,
                  tax_business_name: formData.tax_business_name,
                  w9_signature: formData.w9_signature,
                  w9_certification: formData.w9_certification,
                }}
                onChange={(field, value) => updateField(field as keyof ExtendedOnboardingFormData, value)}
                personnelData={{
                  first_name: formData.first_name,
                  last_name: formData.last_name,
                  address: formData.address || "",
                  city: formData.city || "",
                  state: formData.state || "",
                  zip: formData.zip || "",
                  ssn_full: formData.ssn_full || "",
                }}
              />
            )}

            {/* Step 6: Contractor Agreement */}
            {currentStep === 6 && (
              <ContractorAgreementForm
                data={{
                  ica_signature: formData.ica_signature,
                }}
                onChange={(field, value) => updateField(field as keyof ExtendedOnboardingFormData, value)}
                personnelData={{
                  first_name: formData.first_name,
                  last_name: formData.last_name,
                  address: formData.address || "",
                  city: formData.city || "",
                  state: formData.state || "",
                  zip: formData.zip || "",
                }}
              />
            )}

            {/* Step 7: Emergency Contacts */}
            {currentStep === 7 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please provide at least one emergency contact.
                </p>
                <EmergencyContactForm
                  contacts={formData.emergency_contacts}
                  onChange={(contacts) =>
                    setFormData((prev) => ({ ...prev, emergency_contacts: contacts }))
                  }
                />
              </div>
            )}

            {/* Step 8: Review */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{formData.first_name} {formData.last_name}</span>
                    <span className="text-muted-foreground">Email:</span>
                    <span>{formData.email}</span>
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{formData.phone || "Not provided"}</span>
                    <span className="text-muted-foreground">Date of Birth:</span>
                    <span>{formData.date_of_birth || "Not provided"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Address</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Street:</span>
                    <span>{formData.address || "Not provided"}</span>
                    <span className="text-muted-foreground">City, State ZIP:</span>
                    <span>
                      {[formData.city, formData.state, formData.zip].filter(Boolean).join(", ") || "Not provided"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Work Authorization</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">SSN:</span>
                    <span>***-**-{formData.ssn_full?.slice(-4) || "****"}</span>
                    <span className="text-muted-foreground">Citizenship:</span>
                    <span>{formData.citizenship_status ? CITIZENSHIP_LABELS[formData.citizenship_status] : "Not provided"}</span>
                    {formData.immigration_status && (
                      <>
                        <span className="text-muted-foreground">Immigration Status:</span>
                        <span>{IMMIGRATION_LABELS[formData.immigration_status]}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Documents:</span>
                    <span>{formData.documents.length} uploaded</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Direct Deposit</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Bank:</span>
                    <span>{formData.bank_name}</span>
                    <span className="text-muted-foreground">Account Type:</span>
                    <span className="capitalize">{formData.bank_account_type}</span>
                    <span className="text-muted-foreground">Routing Number:</span>
                    <span>****{formData.bank_routing_number.slice(-4)}</span>
                    <span className="text-muted-foreground">Account Number:</span>
                    <span>****{formData.bank_account_number.slice(-4)}</span>
                    <span className="text-muted-foreground">Signed:</span>
                    <span>{formData.direct_deposit_signature ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">W-9 Tax Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Tax Classification:</span>
                    <span>{TAX_CLASSIFICATION_LABELS[formData.tax_classification] || "Not provided"}</span>
                    {formData.tax_business_name && (
                      <>
                        <span className="text-muted-foreground">Business Name:</span>
                        <span>{formData.tax_business_name}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Certified:</span>
                    <span>{formData.w9_certification ? "Yes" : "No"}</span>
                    <span className="text-muted-foreground">Signed:</span>
                    <span>{formData.w9_signature ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Independent Contractor Agreement</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Signed:</span>
                    <span>{formData.ica_signature ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Emergency Contacts</h3>
                  {formData.emergency_contacts.map((contact, idx) => (
                    <div key={idx} className="text-sm p-3 bg-muted rounded-lg">
                      <p className="font-medium">{contact.name} ({contact.relationship})</p>
                      <p className="text-muted-foreground">{contact.phone}</p>
                      {contact.is_primary && (
                        <span className="text-xs text-primary">Primary Contact</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    />
                    <Label htmlFor="terms" className="text-sm leading-normal cursor-pointer">
                      I certify that the information provided is accurate and complete. I understand
                      that any false statements may be grounds for termination.
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || completeOnboarding.isPending}
                >
                  {completeOnboarding.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Complete Onboarding
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PersonnelOnboarding;
