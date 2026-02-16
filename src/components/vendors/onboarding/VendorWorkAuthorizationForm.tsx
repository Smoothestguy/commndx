import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SSNInput } from "@/components/personnel/registration/SSNInput";
import { ITINInput } from "@/components/personnel/registration/ITINInput";
import { CategoryDocumentUpload } from "@/components/personnel/registration/CategoryDocumentUpload";
import type { VendorOnboardingFormData } from "@/integrations/supabase/hooks/useVendorOnboarding";
import type { RegistrationDocument } from "@/integrations/supabase/hooks/usePersonnelRegistrations";

interface VendorWorkAuthorizationFormProps {
  formData: VendorOnboardingFormData;
  onUpdate: (field: keyof VendorOnboardingFormData, value: any) => void;
  sessionId: string;
}

export const VendorWorkAuthorizationForm = ({
  formData,
  onUpdate,
  sessionId,
}: VendorWorkAuthorizationFormProps) => {
  const citizenshipStatus = formData.citizenship_status;
  const immigrationStatus = formData.immigration_status;

  const handleDocUpload = (doc: RegistrationDocument) => {
    const newDoc = {
      type: doc.document_type || doc.type,
      name: doc.name,
      path: doc.path,
      fileType: doc.type,
      fileSize: 0,
    };
    onUpdate("documents", [...(formData.documents || []), newDoc]);
  };

  const handleDocRemove = (docType: string) => {
    onUpdate(
      "documents",
      (formData.documents || []).filter((d) => d.type !== docType)
    );
  };

  const getExistingDoc = (docType: string): (RegistrationDocument & { verification?: any }) | undefined => {
    const doc = (formData.documents || []).find((d) => d.type === docType);
    if (!doc) return undefined;
    return {
      name: doc.name,
      path: doc.path,
      type: doc.fileType,
      uploaded_at: new Date().toISOString(),
      document_type: doc.type as any,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Work Authorization</h3>
        <p className="text-sm text-muted-foreground">
          Please provide your work authorization information.
        </p>
      </div>

      {/* Citizenship Question */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Are you a U.S. Citizen? *</Label>
        <RadioGroup
          value={citizenshipStatus}
          onValueChange={(v) => {
            onUpdate("citizenship_status", v);
            if (v === "us_citizen") {
              onUpdate("immigration_status", "");
              onUpdate("itin", "");
            }
          }}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="us_citizen" id="us_citizen" />
            <Label htmlFor="us_citizen">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="non_us_citizen" id="non_us_citizen" />
            <Label htmlFor="non_us_citizen">No</Label>
          </div>
        </RadioGroup>
      </div>

      {/* U.S. Citizen - TIN Entry */}
      {citizenshipStatus === "us_citizen" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Taxpayer Identification Number (TIN/SSN/EIN) *</Label>
            <SSNInput
              value={formData.tax_id}
              onChange={(v) => onUpdate("tax_id", v)}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will be used on your W-9 form.
            </p>
          </div>
        </div>
      )}

      {/* Non-U.S. Citizen - Immigration Status */}
      {citizenshipStatus === "non_us_citizen" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Immigration Status *</Label>
            <Select
              value={immigrationStatus}
              onValueChange={(v) => {
                onUpdate("immigration_status", v);
                if (v !== "other") onUpdate("itin", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="work_permit">Work Permit (EAD)</SelectItem>
                <SelectItem value="green_card">Green Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visa */}
          {immigrationStatus === "visa" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Taxpayer Identification Number (TIN) *</Label>
                <SSNInput
                  value={formData.tax_id}
                  onChange={(v) => onUpdate("tax_id", v)}
                  required
                />
              </div>
              <CategoryDocumentUpload
                documentType="visa"
                label="Visa Documentation *"
                helperText="Upload your visa document"
                required
                existingDocument={getExistingDoc("visa")}
                onUpload={handleDocUpload}
                onRemove={() => handleDocRemove("visa")}
                sessionId={sessionId}
              />
            </div>
          )}

          {/* Work Permit / EAD */}
          {immigrationStatus === "work_permit" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Taxpayer Identification Number (TIN) *</Label>
                <SSNInput
                  value={formData.tax_id}
                  onChange={(v) => onUpdate("tax_id", v)}
                  required
                />
              </div>
              <CategoryDocumentUpload
                documentType="work_permit"
                label="Employment Authorization Document (EAD) *"
                helperText="Upload your EAD card"
                required
                existingDocument={getExistingDoc("work_permit")}
                onUpload={handleDocUpload}
                onRemove={() => handleDocRemove("work_permit")}
                sessionId={sessionId}
              />
            </div>
          )}

          {/* Green Card */}
          {immigrationStatus === "green_card" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Taxpayer Identification Number (TIN) *</Label>
                <SSNInput
                  value={formData.tax_id}
                  onChange={(v) => onUpdate("tax_id", v)}
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <CategoryDocumentUpload
                  documentType="green_card_front"
                  label="Green Card (Front) *"
                  required
                  existingDocument={getExistingDoc("green_card_front")}
                  onUpload={handleDocUpload}
                  onRemove={() => handleDocRemove("green_card_front")}
                  sessionId={sessionId}
                />
                <CategoryDocumentUpload
                  documentType="green_card_back"
                  label="Green Card (Back) *"
                  required
                  existingDocument={getExistingDoc("green_card_back")}
                  onUpload={handleDocUpload}
                  onRemove={() => handleDocRemove("green_card_back")}
                  sessionId={sessionId}
                />
              </div>
            </div>
          )}

          {/* Other */}
          {immigrationStatus === "other" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Individual Taxpayer ID Number (ITIN) *</Label>
                <ITINInput
                  value={formData.itin}
                  onChange={(v) => onUpdate("itin", v)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ITIN must be 9 digits and start with 9.
                </p>
              </div>
              <CategoryDocumentUpload
                documentType="other"
                label="Work Authorization Document (Optional)"
                helperText="Upload any work authorization document"
                existingDocument={getExistingDoc("other")}
                onUpload={handleDocUpload}
                onRemove={() => handleDocRemove("other")}
                sessionId={sessionId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
