import { useState, useMemo } from "react";
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
import { CategoryDocumentUpload } from "@/components/personnel/registration/CategoryDocumentUpload";
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
  Clock,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Work Authorization", icon: Shield },
  { id: 4, title: "Emergency Contacts", icon: Users },
  { id: 5, title: "Review & Submit", icon: CheckCircle },
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
  const [submitted, setSubmitted] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Initialize form data from personnel record
  const [formData, setFormData] = useState<OnboardingFormData>({
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
    citizenship_status: undefined,
    immigration_status: undefined,
    emergency_contacts: [],
    documents: [],
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

  const updateField = (field: keyof OnboardingFormData, value: string | CitizenshipStatus | ImmigrationStatus | undefined) => {
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
        // Required: SSN (9 digits), citizenship status, SSN card
        const hasValidSSN = formData.ssn_full?.length === 9;
        const hasCitizenship = !!formData.citizenship_status;
        const hasSSNCard = !!getDocumentByType("ssn_card");

        if (!hasValidSSN || !hasCitizenship || !hasSSNCard) return false;

        // Citizenship-specific requirements
        if (formData.citizenship_status === "us_citizen") {
          return !!getDocumentByType("government_id");
        } else {
          // Non-US citizen needs immigration status and appropriate documents
          if (!formData.immigration_status) return false;

          switch (formData.immigration_status) {
            case "visa":
              return !!getDocumentByType("visa");
            case "work_permit":
              return !!getDocumentByType("work_permit");
            case "green_card":
              return !!getDocumentByType("green_card_front") && !!getDocumentByType("green_card_back");
            case "other":
              return !!getDocumentByType("other");
            default:
              return false;
          }
        }
      }
      case 4:
        return (
          formData.emergency_contacts.length > 0 &&
          formData.emergency_contacts.every(
            (c) =>
              c.name.trim() !== "" &&
              c.relationship.trim() !== "" &&
              c.phone.trim() !== ""
          )
        );
      case 5:
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
    if (!canProceed() || !validationResult?.token || !validationResult?.personnel) return;

    await completeOnboarding.mutateAsync({
      token: validationResult.token.token,
      personnelId: validationResult.personnel.id,
      formData,
    });
    setSubmitted(true);
  };

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

  // Invalid/expired/used token
  if (!validationResult?.isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Invalid Link" description="This onboarding link is invalid" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-warning/10 p-4 w-fit mx-auto mb-4">
              {validationResult?.isExpired ? (
                <Clock className="h-12 w-12 text-warning" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-warning" />
              )}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {validationResult?.isExpired
                ? "Link Expired"
                : validationResult?.isUsed
                  ? "Link Already Used"
                  : "Invalid Link"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {validationResult?.isExpired
                ? "This onboarding link has expired. Please contact your supervisor to request a new link."
                : validationResult?.isUsed
                  ? "This onboarding link has already been used. If you need to make changes, please contact your supervisor."
                  : "This onboarding link is not valid. Please check your email for the correct link or contact your supervisor."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Onboarding Complete" description="Your onboarding has been completed" />
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-success/10 p-4 w-fit mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Onboarding Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for completing your onboarding documentation. Your information has been
              saved and your supervisor will be notified.
            </p>
            <p className="text-sm text-muted-foreground">
              You can close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center ${
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
                  <span className="text-xs hidden sm:block">{step.title}</span>
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
            <CardDescription>
              {currentStep === 1 && "Verify your personal information"}
              {currentStep === 2 && "Provide your current address"}
              {currentStep === 3 && "Share your work authorization details and upload documents"}
              {currentStep === 4 && "Add at least one emergency contact"}
              {currentStep === 5 && "Review your information and submit"}
            </CardDescription>
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

                {/* Social Security Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Social Security Information
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
                    documentType="ssn_card"
                    label="Social Security Card *"
                    helperText="Upload a clear image of your Social Security card"
                    required
                    existingDocument={getDocumentByType("ssn_card")}
                    onUpload={handleDocumentUpload}
                    onRemove={() => handleDocumentRemove("ssn_card")}
                    sessionId={sessionId}
                  />
                </div>

                <div className="border-t pt-6">
                  {/* Citizenship Status */}
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

                    {/* US Citizen Documents */}
                    {formData.citizenship_status === "us_citizen" && (
                      <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Please upload a government-issued ID (Driver's License or Passport)
                        </p>
                        <CategoryDocumentUpload
                          documentType="government_id"
                          label="Government ID (Driver's License or Passport)"
                          helperText="Upload a clear image of your ID"
                          required
                          existingDocument={getDocumentByType("government_id")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("government_id")}
                          sessionId={sessionId}
                        />
                      </div>
                    )}

                    {/* Non-US Citizen Documents */}
                    {formData.citizenship_status === "non_us_citizen" && (
                      <div className="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label>Immigration Status *</Label>
                          <RadioGroup
                            value={formData.immigration_status || ""}
                            onValueChange={(value) => updateField("immigration_status", value as ImmigrationStatus)}
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

                        {/* Visa Document */}
                        {formData.immigration_status === "visa" && (
                          <CategoryDocumentUpload
                            documentType="visa"
                            label="Visa Document"
                            helperText="Upload your visa document"
                            required
                            existingDocument={getDocumentByType("visa")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("visa")}
                            sessionId={sessionId}
                          />
                        )}

                        {/* Work Permit / EAD */}
                        {formData.immigration_status === "work_permit" && (
                          <CategoryDocumentUpload
                            documentType="work_permit"
                            label="Work Permit (EAD)"
                            helperText="Upload your Employment Authorization Document"
                            required
                            existingDocument={getDocumentByType("work_permit")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("work_permit")}
                            sessionId={sessionId}
                          />
                        )}

                        {/* Green Card */}
                        {formData.immigration_status === "green_card" && (
                          <div className="space-y-4">
                            <CategoryDocumentUpload
                              documentType="green_card_front"
                              label="Green Card (Front)"
                              helperText="Upload the front of your Green Card"
                              required
                              existingDocument={getDocumentByType("green_card_front")}
                              onUpload={handleDocumentUpload}
                              onRemove={() => handleDocumentRemove("green_card_front")}
                              sessionId={sessionId}
                            />
                            <CategoryDocumentUpload
                              documentType="green_card_back"
                              label="Green Card (Back)"
                              helperText="Upload the back of your Green Card"
                              required
                              existingDocument={getDocumentByType("green_card_back")}
                              onUpload={handleDocumentUpload}
                              onRemove={() => handleDocumentRemove("green_card_back")}
                              sessionId={sessionId}
                            />
                          </div>
                        )}

                        {/* Other Document */}
                        {formData.immigration_status === "other" && (
                          <CategoryDocumentUpload
                            documentType="other"
                            label="Work Authorization Document"
                            helperText="Upload your work authorization document"
                            required
                            existingDocument={getDocumentByType("other")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("other")}
                            sessionId={sessionId}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Emergency Contacts */}
            {currentStep === 4 && (
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

            {/* Step 5: Review */}
            {currentStep === 5 && (
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
