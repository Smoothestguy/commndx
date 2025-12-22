import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useSubmitRegistration,
  type EmergencyContact,
  type RegistrationDocument,
  type RegistrationFormData,
  type CitizenshipStatus,
  type ImmigrationStatus,
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

const PersonnelRegistrationPortal = () => {
  const navigate = useNavigate();
  const submitRegistration = useSubmitRegistration();

  // Generate a session ID for document uploads
  const sessionId = useMemo(
    () => `reg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    []
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Form data
  const [formData, setFormData] = useState<RegistrationFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    work_authorization_type: "",
    work_auth_expiry: "",
    ssn_last_four: "",
    ssn_full: "",
    citizenship_status: undefined,
    immigration_status: undefined,
    emergency_contacts: [],
    documents: [],
  });

  const updateField = (field: keyof RegistrationFormData, value: string | CitizenshipStatus | ImmigrationStatus | undefined) => {
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
        // Required: citizenship status only (SSN is optional)
        const hasCitizenship = !!formData.citizenship_status;

        if (!hasCitizenship) return false;

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
    if (!canProceed()) return;

    await submitRegistration.mutateAsync(formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO
          title="Registration Submitted"
          description="Your personnel registration has been submitted"
        />
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-success/10 p-4 w-fit mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Registration Submitted!
            </h2>
            <p className="text-muted-foreground mb-6">
              Thank you for submitting your registration. Our team will review
              your application and contact you at{" "}
              <span className="font-medium text-foreground">
                {formData.email}
              </span>{" "}
              once it has been processed.
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <SEO
        title="Personnel Registration"
        description="Register to join our workforce"
      />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Join Our Team</h1>
          <p className="text-muted-foreground">
            Complete the form below to register as personnel
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
              {currentStep === 1 && "Enter your basic personal information"}
              {currentStep === 2 && "Provide your current address"}
              {currentStep === 3 &&
                "Share your work authorization details and upload supporting documents"}
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
                      onChange={(e) =>
                        updateField("date_of_birth", e.target.value)
                      }
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

            {/* Step 3: Work Authorization & Employment Verification */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This information is required for E-Verify employment verification. All documents will be securely stored and only accessible to authorized personnel.
                  </AlertDescription>
                </Alert>

                {/* Social Security Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Social Security Information
                  </h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ssn_full">
                      Social Security Number *
                    </Label>
                    <SSNInput
                      value={formData.ssn_full || ""}
                      onChange={(value) => updateField("ssn_full", value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for E-Verify employment verification
                    </p>
                  </div>

                  <CategoryDocumentUpload
                    documentType="ssn_card"
                    label="Social Security Card"
                    helperText="Upload a clear image of your Social Security card (optional)"
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
                          // Reset immigration status when citizenship changes
                          if (value === "us_citizen") {
                            updateField("immigration_status", undefined);
                          }
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="us_citizen" id="us_citizen" />
                          <Label htmlFor="us_citizen" className="font-normal cursor-pointer">
                            U.S. Citizen
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non_us_citizen" id="non_us_citizen" />
                          <Label htmlFor="non_us_citizen" className="font-normal cursor-pointer">
                            Non-U.S. Citizen
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>

                {/* US Citizen - Government ID Required */}
                {formData.citizenship_status === "us_citizen" && (
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Identity Verification
                    </h3>
                    <CategoryDocumentUpload
                      documentType="government_id"
                      label="Government-Issued ID"
                      helperText="Driver's License, State ID, or Passport"
                      required
                      existingDocument={getDocumentByType("government_id")}
                      onUpload={handleDocumentUpload}
                      onRemove={() => handleDocumentRemove("government_id")}
                      sessionId={sessionId}
                    />
                  </div>
                )}

                {/* Non-US Citizen - Immigration Status */}
                {formData.citizenship_status === "non_us_citizen" && (
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Immigration Status
                    </h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="immigration_status">Immigration Status *</Label>
                      <Select
                        value={formData.immigration_status || ""}
                        onValueChange={(value) => updateField("immigration_status", value as ImmigrationStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your immigration status" />
                        </SelectTrigger>
                        <SelectContent>
                          {IMMIGRATION_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Visa Documents */}
                    {formData.immigration_status === "visa" && (
                      <div className="space-y-4">
                        <CategoryDocumentUpload
                          documentType="visa"
                          label="Visa Documentation"
                          helperText="Upload your visa stamp or I-94"
                          required
                          existingDocument={getDocumentByType("visa")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("visa")}
                          sessionId={sessionId}
                        />
                        <div className="space-y-2">
                          <Label htmlFor="work_auth_expiry">Visa Expiry Date</Label>
                          <Input
                            id="work_auth_expiry"
                            type="date"
                            value={formData.work_auth_expiry || ""}
                            onChange={(e) => updateField("work_auth_expiry", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Work Permit (EAD) Documents */}
                    {formData.immigration_status === "work_permit" && (
                      <div className="space-y-4">
                        <CategoryDocumentUpload
                          documentType="work_permit"
                          label="Employment Authorization Document (EAD)"
                          helperText="Upload your EAD card (front)"
                          required
                          existingDocument={getDocumentByType("work_permit")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("work_permit")}
                          sessionId={sessionId}
                        />
                        <div className="space-y-2">
                          <Label htmlFor="work_auth_expiry">EAD Expiry Date</Label>
                          <Input
                            id="work_auth_expiry"
                            type="date"
                            value={formData.work_auth_expiry || ""}
                            onChange={(e) => updateField("work_auth_expiry", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Green Card Documents - Front and Back Required */}
                    {formData.immigration_status === "green_card" && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          For E-Verify purposes, please upload both sides of your Green Card.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <CategoryDocumentUpload
                            documentType="green_card_front"
                            label="Green Card (Front)"
                            helperText="Front side with photo"
                            required
                            existingDocument={getDocumentByType("green_card_front")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("green_card_front")}
                            sessionId={sessionId}
                          />
                          <CategoryDocumentUpload
                            documentType="green_card_back"
                            label="Green Card (Back)"
                            helperText="Back side with number"
                            required
                            existingDocument={getDocumentByType("green_card_back")}
                            onUpload={handleDocumentUpload}
                            onRemove={() => handleDocumentRemove("green_card_back")}
                            sessionId={sessionId}
                          />
                        </div>
                      </div>
                    )}

                    {/* Other Immigration Status */}
                    {formData.immigration_status === "other" && (
                      <div className="space-y-4">
                        <CategoryDocumentUpload
                          documentType="other"
                          label="Work Authorization Document"
                          helperText="Upload relevant work authorization documentation"
                          required
                          existingDocument={getDocumentByType("other")}
                          onUpload={handleDocumentUpload}
                          onRemove={() => handleDocumentRemove("other")}
                          sessionId={sessionId}
                        />
                        <div className="space-y-2">
                          <Label htmlFor="work_auth_expiry">Authorization Expiry Date</Label>
                          <Input
                            id="work_auth_expiry"
                            type="date"
                            value={formData.work_auth_expiry || ""}
                            onChange={(e) => updateField("work_auth_expiry", e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Emergency Contacts */}
            {currentStep === 4 && (
              <EmergencyContactForm
                contacts={formData.emergency_contacts}
                onChange={(contacts) =>
                  setFormData((prev) => ({
                    ...prev,
                    emergency_contacts: contacts,
                  }))
                }
              />
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {/* Personal Info Review */}
                <div className="space-y-2">
                  <h4 className="font-medium">Personal Information</h4>
                  <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {formData.first_name} {formData.last_name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      {formData.email}
                    </p>
                    {formData.phone && (
                      <p>
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        {formData.phone}
                      </p>
                    )}
                    {formData.date_of_birth && (
                      <p>
                        <span className="text-muted-foreground">DOB:</span>{" "}
                        {new Date(formData.date_of_birth).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Address Review */}
                {(formData.address ||
                  formData.city ||
                  formData.state ||
                  formData.zip) && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Address</h4>
                    <div className="bg-muted rounded-lg p-4 text-sm">
                      <p>
                        {[
                          formData.address,
                          formData.city,
                          formData.state,
                          formData.zip,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Employment Verification Review */}
                <div className="space-y-2">
                  <h4 className="font-medium">Employment Verification</h4>
                  <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                    <p>
                      <span className="text-muted-foreground">SSN:</span>{" "}
                      •••-••-{formData.ssn_full?.slice(-4) || "****"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Citizenship:</span>{" "}
                      {formData.citizenship_status ? CITIZENSHIP_LABELS[formData.citizenship_status] : "-"}
                    </p>
                    {formData.citizenship_status === "non_us_citizen" && formData.immigration_status && (
                      <p>
                        <span className="text-muted-foreground">Immigration Status:</span>{" "}
                        {IMMIGRATION_LABELS[formData.immigration_status]}
                      </p>
                    )}
                    {formData.work_auth_expiry && (
                      <p>
                        <span className="text-muted-foreground">Authorization Expires:</span>{" "}
                        {new Date(formData.work_auth_expiry).toLocaleDateString()}
                      </p>
                    )}
                    {formData.documents.length > 0 && (
                      <div className="pt-2 border-t mt-2">
                        <span className="text-muted-foreground">Documents Uploaded:</span>
                        <ul className="list-disc list-inside mt-1">
                          {formData.documents.map((doc, i) => (
                            <li key={i}>{doc.label || doc.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Emergency Contacts Review */}
                <div className="space-y-2">
                  <h4 className="font-medium">Emergency Contacts</h4>
                  <div className="bg-muted rounded-lg p-4 text-sm space-y-3">
                    {formData.emergency_contacts.map((contact, index) => (
                      <div key={index}>
                        <p className="font-medium">
                          {contact.name}
                          {contact.is_primary && (
                            <span className="text-xs bg-primary/10 text-primary ml-2 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          {contact.relationship} • {contact.phone}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start space-x-2 pt-4 border-t">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) =>
                      setAgreedToTerms(!!checked)
                    }
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm font-normal leading-relaxed cursor-pointer"
                  >
                    I certify that the information provided is accurate and
                    complete to the best of my knowledge. I understand that
                    providing false information may result in disqualification
                    from employment.
                  </Label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canProceed() || submitRegistration.isPending}
                >
                  {submitRegistration.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Registration
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

export default PersonnelRegistrationPortal;
