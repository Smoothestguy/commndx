import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAddPersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { SSNInput } from "@/components/personnel/registration/SSNInput";
import { ITINInput } from "@/components/personnel/registration/ITINInput";
import { DocumentUpload } from "@/components/personnel/registration/DocumentUpload";
import { toast } from "sonner";

interface UploadedDocument {
  name: string;
  file: File;
  type: string;
}

type CitizenshipStatus = "us_citizen" | "non_us_citizen" | "";
type ImmigrationStatus = "visa" | "work_permit" | "green_card" | "other" | "";

const PersonnelRegister = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  
  // Step 3 specific state
  const [citizenshipStatus, setCitizenshipStatus] = useState<CitizenshipStatus>("");
  const [immigrationStatus, setImmigrationStatus] = useState<ImmigrationStatus>("");
  const [ssn, setSsn] = useState("");
  const [itin, setItin] = useState("");
  const [documents, setDocuments] = useState<Record<string, UploadedDocument | null>>({
    government_id: null,
    visa: null,
    work_permit: null,
    green_card_front: null,
    green_card_back: null,
    work_authorization: null,
  });

  const navigate = useNavigate();
  const addPersonnel = useAddPersonnel();

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentUpload = (docType: string, doc: UploadedDocument | null) => {
    setDocuments((prev) => ({ ...prev, [docType]: doc }));
  };

  const handleImmigrationStatusChange = (value: ImmigrationStatus) => {
    setImmigrationStatus(value);
    // Clear documents when status changes
    setDocuments({
      government_id: null,
      visa: null,
      work_permit: null,
      green_card_front: null,
      green_card_back: null,
      work_authorization: null,
    });
    // Clear SSN/ITIN when switching
    setSsn("");
    setItin("");
  };

  const handleCitizenshipChange = (value: CitizenshipStatus) => {
    setCitizenshipStatus(value);
    setImmigrationStatus("");
    setSsn("");
    setItin("");
    setDocuments({
      government_id: null,
      visa: null,
      work_permit: null,
      green_card_front: null,
      green_card_back: null,
      work_authorization: null,
    });
  };

  const validateStep3 = (): boolean => {
    if (!citizenshipStatus) {
      toast.error("Please select your citizenship status");
      return false;
    }

    if (citizenshipStatus === "us_citizen") {
      if (ssn.length !== 9) {
        toast.error("Please enter a valid 9-digit SSN");
        return false;
      }
      if (!documents.government_id) {
        toast.error("Please upload your government ID");
        return false;
      }
    } else {
      if (!immigrationStatus) {
        toast.error("Please select your immigration status");
        return false;
      }

      if (immigrationStatus === "other") {
        if (itin.length !== 9 || !itin.startsWith("9")) {
          toast.error("Please enter a valid 9-digit ITIN (must start with 9)");
          return false;
        }
        // Work authorization document is optional
      } else {
        if (ssn.length !== 9) {
          toast.error("Please enter a valid 9-digit SSN");
          return false;
        }

        if (immigrationStatus === "visa" && !documents.visa) {
          toast.error("Please upload your visa documentation");
          return false;
        }
        if (immigrationStatus === "work_permit" && !documents.work_permit) {
          toast.error("Please upload your EAD document");
          return false;
        }
        if (immigrationStatus === "green_card") {
          if (!documents.green_card_front || !documents.green_card_back) {
            toast.error("Please upload both front and back of your Green Card");
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    // Map work authorization type for database
    let workAuthType = "";
    if (citizenshipStatus === "us_citizen") {
      workAuthType = "citizen";
    } else {
      workAuthType = immigrationStatus;
    }

    await addPersonnel.mutateAsync({
      ...formData,
      work_authorization_type: workAuthType as any,
      ssn_full: citizenshipStatus === "non_us_citizen" && immigrationStatus === "other" ? undefined : ssn,
      citizenship_status: citizenshipStatus as any,
      immigration_status: citizenshipStatus === "non_us_citizen" ? immigrationStatus as any : undefined,
      personnel_number: "",
      status: "active",
      everify_status: "pending",
    });

    navigate("/personnel");
  };

  const renderStep3Content = () => {
    return (
      <div className="space-y-6">
        {/* Citizenship Question */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Are you a U.S. Citizen? *</Label>
          <RadioGroup
            value={citizenshipStatus}
            onValueChange={(value) => handleCitizenshipChange(value as CitizenshipStatus)}
            className="flex gap-6"
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

        {/* U.S. Citizen Flow */}
        {citizenshipStatus === "us_citizen" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="ssn">Social Security Number (SSN) *</Label>
              <SSNInput value={ssn} onChange={setSsn} required />
            </div>
            <DocumentUpload
              label="Government-Issued ID"
              documentType="government_id"
              required
              uploadedDoc={documents.government_id}
              onUpload={(doc) => handleDocumentUpload("government_id", doc)}
            />
            <p className="text-xs text-muted-foreground">
              Upload your Driver's License or Passport
            </p>
          </div>
        )}

        {/* Non-U.S. Citizen Flow */}
        {citizenshipStatus === "non_us_citizen" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="immigration_status">Immigration Status *</Label>
              <Select
                value={immigrationStatus}
                onValueChange={(value) => handleImmigrationStatusChange(value as ImmigrationStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your immigration status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="work_permit">Work Permit (EAD)</SelectItem>
                  <SelectItem value="green_card">Green Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Visa Flow */}
            {immigrationStatus === "visa" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Social Security Number (SSN) *</Label>
                  <SSNInput value={ssn} onChange={setSsn} required />
                </div>
                <DocumentUpload
                  label="Visa Documentation"
                  documentType="visa"
                  required
                  uploadedDoc={documents.visa}
                  onUpload={(doc) => handleDocumentUpload("visa", doc)}
                />
                <p className="text-xs text-muted-foreground">
                  Upload your visa stamp or I-94 document
                </p>
              </div>
            )}

            {/* Work Permit Flow */}
            {immigrationStatus === "work_permit" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Social Security Number (SSN) *</Label>
                  <SSNInput value={ssn} onChange={setSsn} required />
                </div>
                <DocumentUpload
                  label="Employment Authorization Document (EAD)"
                  documentType="work_permit"
                  required
                  uploadedDoc={documents.work_permit}
                  onUpload={(doc) => handleDocumentUpload("work_permit", doc)}
                />
              </div>
            )}

            {/* Green Card Flow */}
            {immigrationStatus === "green_card" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Social Security Number (SSN) *</Label>
                  <SSNInput value={ssn} onChange={setSsn} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DocumentUpload
                    label="Green Card (Front)"
                    documentType="green_card_front"
                    required
                    uploadedDoc={documents.green_card_front}
                    onUpload={(doc) => handleDocumentUpload("green_card_front", doc)}
                  />
                  <DocumentUpload
                    label="Green Card (Back)"
                    documentType="green_card_back"
                    required
                    uploadedDoc={documents.green_card_back}
                    onUpload={(doc) => handleDocumentUpload("green_card_back", doc)}
                  />
                </div>
              </div>
            )}

            {/* Other Flow */}
            {immigrationStatus === "other" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Individual Taxpayer ID Number (ITIN) *</Label>
                  <ITINInput value={itin} onChange={setItin} required />
                  <p className="text-xs text-muted-foreground">
                    ITIN must be 9 digits and start with 9
                  </p>
                </div>
                <DocumentUpload
                  label="Work Authorization Document"
                  documentType="work_authorization"
                  required
                  uploadedDoc={documents.work_authorization}
                  onUpload={(doc) => handleDocumentUpload("work_authorization", doc)}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setStep(2)}>
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addPersonnel.isPending}
          >
            {addPersonnel.isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <SEO
        title="Personnel Registration"
        description="Register as personnel to join our workforce"
      />

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Personnel Registration</CardTitle>
            <CardDescription>
              Fill out this form to register as a personnel member
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => updateFormData("first_name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => updateFormData("last_name", e.target.value)}
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
                    onChange={(e) => updateFormData("email", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)}>Next</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateFormData("address", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => updateFormData("state", e.target.value)}
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => updateFormData("zip", e.target.value)}
                  />
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)}>Next</Button>
                </div>
              </div>
            )}

            {step === 3 && renderStep3Content()}

            <div className="mt-6 flex justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 w-2 rounded-full ${
                    s === step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PersonnelRegister;
