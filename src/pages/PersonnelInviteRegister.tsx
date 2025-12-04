import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PhotoUpload } from "@/components/personnel/PhotoUpload";
import { EmergencyContactForm } from "@/components/personnel/registration/EmergencyContactForm";
import { SEO } from "@/components/SEO";
import { usePersonnelRegistrationInviteByToken, useCompletePersonnelRegistrationInvite } from "@/integrations/supabase/hooks/usePersonnelRegistrationInvites";
import { useAddPersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import type { EmergencyContact } from "@/integrations/supabase/hooks/usePersonnelRegistrations";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, User, MapPin, Shield, Phone, FileCheck } from "lucide-react";

const WORK_AUTH_TYPES_REQUIRING_EXPIRY = ["work_visa", "ead", "other"];

const PersonnelInviteRegister = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: invite, isLoading: inviteLoading, error: inviteError } = usePersonnelRegistrationInviteByToken(token);
  const completeInvite = useCompletePersonnelRegistrationInvite();
  const addPersonnel = useAddPersonnel();

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    photo_url: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    date_of_birth: "",
    work_authorization_type: "",
    work_auth_expiry: "",
    ssn_last_four: "",
  });

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

  // Pre-fill from invite
  useEffect(() => {
    if (invite) {
      setFormData((prev) => ({
        ...prev,
        first_name: invite.first_name || "",
        last_name: invite.last_name || "",
        email: invite.email,
      }));
    }
  }, [invite]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const requiresExpiry = WORK_AUTH_TYPES_REQUIRING_EXPIRY.includes(formData.work_authorization_type);

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!formData.first_name || !formData.last_name || !formData.email) {
          toast.error("Please fill in all required fields");
          return false;
        }
        return true;
      case 2:
        return true; // Address is optional
      case 3:
        if (!formData.work_authorization_type) {
          toast.error("Please select your work authorization type");
          return false;
        }
        if (requiresExpiry && !formData.work_auth_expiry) {
          toast.error("Please enter your authorization expiry date");
          return false;
        }
        return true;
      case 4:
        return true; // Emergency contacts optional but recommended
      case 5:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create personnel record
      const personnelData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        photo_url: formData.photo_url || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip: formData.zip || null,
        date_of_birth: formData.date_of_birth || null,
        work_authorization_type: formData.work_authorization_type || null,
        work_auth_expiry: requiresExpiry ? formData.work_auth_expiry || null : null,
        ssn_last_four: formData.ssn_last_four || null,
        status: "active",
        everify_status: "pending",
        personnel_number: "",
      };

      await addPersonnel.mutateAsync(personnelData);

      // Mark invite as completed
      if (token) {
        await completeInvite.mutateAsync(token);
      }

      toast.success("Registration completed successfully!");
      setStep(6); // Success step
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to complete registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please contact your
              administrator for a new invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invite.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Already Registered</CardTitle>
            <CardDescription>
              This invitation has already been used. If you need to update your
              information, please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please contact your administrator for a
              new invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state
  if (step === 6) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <SEO title="Registration Complete" description="Your registration has been completed successfully" />
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Registration Complete!</CardTitle>
            <CardDescription className="text-base">
              Thank you for completing your registration. Your information has been
              submitted and you'll be notified once your account is fully set up.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const stepIcons = [
    { icon: User, label: "Personal" },
    { icon: MapPin, label: "Address" },
    { icon: Shield, label: "Work Auth" },
    { icon: Phone, label: "Emergency" },
    { icon: FileCheck, label: "Review" },
  ];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <SEO title="Complete Registration" description="Complete your personnel registration" />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Your Registration</h1>
          <p className="text-muted-foreground">
            Welcome! Please fill out the information below.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {stepIcons.map((s, index) => (
              <div
                key={index}
                className={`flex flex-col items-center ${
                  index + 1 <= step ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    index + 1 < step
                      ? "bg-primary border-primary text-primary-foreground"
                      : index + 1 === step
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                  }`}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-xs mt-1 hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Personal Information</h2>
                  <p className="text-muted-foreground">Basic details and profile photo</p>
                </div>

                <PhotoUpload
                  currentPhotoUrl={formData.photo_url}
                  onPhotoChange={(url) => updateField("photo_url", url)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => updateField("first_name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
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
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
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
            )}

            {/* Step 2: Address */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Address</h2>
                  <p className="text-muted-foreground">Your current address</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      maxLength={2}
                      placeholder="TX"
                      value={formData.state}
                      onChange={(e) => updateField("state", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Work Authorization */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Work Authorization</h2>
                  <p className="text-muted-foreground">I-9 compliance information</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="work_authorization_type">Work Authorization Type *</Label>
                  <Select
                    value={formData.work_authorization_type}
                    onValueChange={(value) => {
                      updateField("work_authorization_type", value);
                      // Clear expiry if switching to type that doesn't require it
                      if (!WORK_AUTH_TYPES_REQUIRING_EXPIRY.includes(value)) {
                        updateField("work_auth_expiry", "");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your work authorization type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="citizen">U.S. Citizen</SelectItem>
                      <SelectItem value="permanent_resident">Permanent Resident (Green Card)</SelectItem>
                      <SelectItem value="work_visa">Work Visa (H-1B, L-1, etc.)</SelectItem>
                      <SelectItem value="ead">Employment Authorization Document (EAD)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requiresExpiry && (
                  <div className="space-y-2">
                    <Label htmlFor="work_auth_expiry">Authorization Expiry Date *</Label>
                    <Input
                      id="work_auth_expiry"
                      type="date"
                      value={formData.work_auth_expiry}
                      onChange={(e) => updateField("work_auth_expiry", e.target.value)}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      When does your work authorization expire?
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="ssn_last_four">SSN (Last 4 Digits)</Label>
                  <Input
                    id="ssn_last_four"
                    maxLength={4}
                    placeholder="****"
                    value={formData.ssn_last_four}
                    onChange={(e) => updateField("ssn_last_four", e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-sm text-muted-foreground">
                    For verification purposes only. Your data is encrypted.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Emergency Contacts */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Emergency Contacts</h2>
                  <p className="text-muted-foreground">
                    Who should we contact in case of emergency?
                  </p>
                </div>

                <EmergencyContactForm
                  contacts={emergencyContacts}
                  onChange={setEmergencyContacts}
                />
              </div>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Review Your Information</h2>
                  <p className="text-muted-foreground">
                    Please verify everything looks correct
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-medium mb-2">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{formData.first_name} {formData.last_name}</span>
                      <span className="text-muted-foreground">Email:</span>
                      <span>{formData.email}</span>
                      {formData.phone && (
                        <>
                          <span className="text-muted-foreground">Phone:</span>
                          <span>{formData.phone}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {(formData.address || formData.city) && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-medium mb-2">Address</h3>
                      <p className="text-sm">
                        {formData.address && <>{formData.address}<br /></>}
                        {formData.city && `${formData.city}, `}
                        {formData.state} {formData.zip}
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-medium mb-2">Work Authorization</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <span>
                        {formData.work_authorization_type === "citizen" && "U.S. Citizen"}
                        {formData.work_authorization_type === "permanent_resident" && "Permanent Resident"}
                        {formData.work_authorization_type === "work_visa" && "Work Visa"}
                        {formData.work_authorization_type === "ead" && "EAD"}
                        {formData.work_authorization_type === "other" && "Other"}
                      </span>
                      {requiresExpiry && formData.work_auth_expiry && (
                        <>
                          <span className="text-muted-foreground">Expires:</span>
                          <span>{new Date(formData.work_auth_expiry).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {emergencyContacts.length > 0 && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-medium mb-2">Emergency Contacts</h3>
                      {emergencyContacts.map((contact, index) => (
                        <div key={index} className="text-sm">
                          {contact.name} ({contact.relationship}) - {contact.phone}
                          {contact.is_primary && <span className="text-primary ml-2">(Primary)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
              >
                Back
              </Button>

              {step < 5 ? (
                <Button onClick={handleNext}>Continue</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Complete Registration"
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

export default PersonnelInviteRegister;
