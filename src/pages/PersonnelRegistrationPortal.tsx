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
import { SEO } from "@/components/SEO";
import { EmergencyContactForm } from "@/components/personnel/registration/EmergencyContactForm";
import { RegistrationDocumentUpload } from "@/components/personnel/registration/RegistrationDocumentUpload";
import {
  useSubmitRegistration,
  type EmergencyContact,
  type RegistrationDocument,
  type RegistrationFormData,
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
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Work Authorization", icon: Shield },
  { id: 4, title: "Emergency Contacts", icon: Users },
  { id: 5, title: "Review & Submit", icon: CheckCircle },
];

const WORK_AUTH_TYPES = [
  { value: "citizen", label: "U.S. Citizen" },
  { value: "permanent_resident", label: "Permanent Resident" },
  { value: "work_visa", label: "Work Visa (H-1B, L-1, etc.)" },
  { value: "ead", label: "Employment Authorization Document (EAD)" },
  { value: "other", label: "Other" },
];

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
    emergency_contacts: [],
    documents: [],
  });

  const updateField = (field: keyof RegistrationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      case 3:
        return formData.work_authorization_type !== "";
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

            {/* Step 3: Work Authorization */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="work_auth_type">
                      Work Authorization Type *
                    </Label>
                    <Select
                      value={formData.work_authorization_type}
                      onValueChange={(value) =>
                        updateField("work_authorization_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select authorization type" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_AUTH_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.work_authorization_type &&
                    formData.work_authorization_type !== "citizen" && (
                      <div className="space-y-2">
                        <Label htmlFor="work_auth_expiry">
                          Authorization Expiry Date
                        </Label>
                        <Input
                          id="work_auth_expiry"
                          type="date"
                          value={formData.work_auth_expiry}
                          onChange={(e) =>
                            updateField("work_auth_expiry", e.target.value)
                          }
                        />
                      </div>
                    )}

                  <div className="space-y-2">
                    <Label htmlFor="ssn_last_four">
                      Last 4 Digits of SSN (optional)
                    </Label>
                    <Input
                      id="ssn_last_four"
                      value={formData.ssn_last_four}
                      onChange={(e) =>
                        updateField(
                          "ssn_last_four",
                          e.target.value.replace(/\D/g, "").slice(0, 4)
                        )
                      }
                      placeholder="1234"
                      maxLength={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for verification purposes only
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Supporting Documents</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload ID, work authorization documents, or other relevant
                    files
                  </p>
                  <RegistrationDocumentUpload
                    documents={formData.documents}
                    onChange={(docs) =>
                      setFormData((prev) => ({ ...prev, documents: docs }))
                    }
                    sessionId={sessionId}
                  />
                </div>
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

                {/* Work Authorization Review */}
                <div className="space-y-2">
                  <h4 className="font-medium">Work Authorization</h4>
                  <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {WORK_AUTH_TYPES.find(
                        (t) => t.value === formData.work_authorization_type
                      )?.label || "-"}
                    </p>
                    {formData.work_auth_expiry && (
                      <p>
                        <span className="text-muted-foreground">Expires:</span>{" "}
                        {new Date(
                          formData.work_auth_expiry
                        ).toLocaleDateString()}
                      </p>
                    )}
                    {formData.documents.length > 0 && (
                      <p>
                        <span className="text-muted-foreground">
                          Documents:
                        </span>{" "}
                        {formData.documents.length} file(s) uploaded
                      </p>
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
