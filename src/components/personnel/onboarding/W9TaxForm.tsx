import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { Info } from "lucide-react";

interface W9TaxFormProps {
  data: {
    tax_classification: string;
    tax_ein: string;
    tax_business_name: string;
    w9_signature: string | null;
    w9_certification: boolean;
  };
  onChange: (field: string, value: string | boolean | null) => void;
  personnelData: {
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    ssn_full: string;
  };
}

const TAX_CLASSIFICATIONS = [
  { value: "individual", label: "Individual/sole proprietor or single-member LLC" },
  { value: "c_corporation", label: "C Corporation" },
  { value: "s_corporation", label: "S Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/estate" },
  { value: "llc_c", label: "LLC - taxed as C corporation" },
  { value: "llc_s", label: "LLC - taxed as S corporation" },
  { value: "llc_p", label: "LLC - taxed as Partnership" },
];

export function W9TaxForm({ data, onChange, personnelData }: W9TaxFormProps) {
  const fullName = `${personnelData.first_name} ${personnelData.last_name}`;
  const fullAddress = [
    personnelData.address,
    [personnelData.city, personnelData.state, personnelData.zip].filter(Boolean).join(", ")
  ].filter(Boolean).join("\n");

  const needsEIN = data.tax_classification && !["individual"].includes(data.tax_classification);

  const validateEIN = (value: string) => {
    // EIN format: XX-XXXXXXX (9 digits total, can include dash)
    return /^[\d-]{0,10}$/.test(value);
  };

  const formatSSN = (ssn: string) => {
    if (!ssn || ssn.length !== 9) return "Not provided";
    return `***-**-${ssn.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This form is used to provide your taxpayer identification information. The information
          you provide will be used for tax reporting purposes.
        </AlertDescription>
      </Alert>

      {/* Name and Business Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Taxpayer Information
        </h3>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label>Name (as shown on your income tax return)</Label>
            <div className="p-3 bg-muted rounded-md text-sm">{fullName}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_business_name">Business Name (if different from above)</Label>
            <Input
              id="tax_business_name"
              value={data.tax_business_name}
              onChange={(e) => onChange("tax_business_name", e.target.value)}
              placeholder="Optional - enter if you operate under a business name"
            />
          </div>
        </div>
      </div>

      {/* Tax Classification */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Federal Tax Classification *
        </h3>
        
        <RadioGroup
          value={data.tax_classification}
          onValueChange={(value) => onChange("tax_classification", value)}
          className="grid gap-2"
        >
          {TAX_CLASSIFICATIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="cursor-pointer text-sm">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* EIN if needed */}
      {needsEIN && (
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <Label htmlFor="tax_ein">Employer Identification Number (EIN) *</Label>
          <Input
            id="tax_ein"
            value={data.tax_ein}
            onChange={(e) => {
              if (validateEIN(e.target.value)) {
                onChange("tax_ein", e.target.value);
              }
            }}
            placeholder="XX-XXXXXXX"
            maxLength={10}
            required
          />
          <p className="text-xs text-muted-foreground">
            Required for businesses. Format: XX-XXXXXXX
          </p>
        </div>
      )}

      {/* Address Display */}
      <div className="space-y-2">
        <Label>Address</Label>
        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-line">
          {fullAddress || "Not provided"}
        </div>
      </div>

      {/* TIN Display */}
      <div className="space-y-2">
        <Label>Social Security Number</Label>
        <div className="p-3 bg-muted rounded-md text-sm">
          {formatSSN(personnelData.ssn_full)}
        </div>
      </div>

      {/* Certification */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Certification
        </h3>
        
        <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
          <p className="font-medium">Under penalties of perjury, I certify that:</p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and</li>
            <li>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and</li>
            <li>I am a U.S. citizen or other U.S. person; and</li>
            <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
          </ol>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="w9_certification"
            checked={data.w9_certification}
            onCheckedChange={(checked) => onChange("w9_certification", checked === true)}
          />
          <Label htmlFor="w9_certification" className="text-sm leading-normal cursor-pointer">
            I certify, under penalties of perjury, that the information provided is true, correct, and complete.
          </Label>
        </div>

        <SignaturePad
          value={data.w9_signature || undefined}
          onChange={(sig) => onChange("w9_signature", sig)}
          label="Signature of U.S. Person *"
          required
          helpText="Sign above to certify the information provided"
        />
      </div>
    </div>
  );
}
