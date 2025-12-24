import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Check } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

interface VendorW9FormProps {
  formData: {
    name: string;
    company: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    tax_id: string;
    track_1099: boolean;
    w9_signature: string | null;
  };
  onUpdate: (field: string, value: string | boolean | null) => void;
}

const TAX_CLASSIFICATIONS = [
  { value: "individual", label: "Individual/sole proprietor or single-member LLC" },
  { value: "c_corporation", label: "C Corporation" },
  { value: "s_corporation", label: "S Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/estate" },
  { value: "llc", label: "Limited liability company" },
];

export function VendorW9Form({ formData, onUpdate }: VendorW9FormProps) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [taxClassification, setTaxClassification] = useState("individual");

  const handleClearSignature = () => {
    sigCanvasRef.current?.clear();
    onUpdate("w9_signature", null);
  };

  const handleSaveSignature = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const signatureData = sigCanvasRef.current.toDataURL("image/png");
      onUpdate("w9_signature", signatureData);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">W-9 Tax Form</p>
              <p className="text-xs text-muted-foreground">
                Request for Taxpayer Identification Number and Certification. This information is
                required for tax reporting purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Name */}
      <div className="space-y-2">
        <Label>Name (as shown on your income tax return) *</Label>
        <Input
          value={formData.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="Legal name"
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          This is pre-filled from your company information.
        </p>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <Label>Business name/disregarded entity name (if different)</Label>
        <Input
          value={formData.company}
          onChange={(e) => onUpdate("company", e.target.value)}
          placeholder="Business name (if different from above)"
        />
      </div>

      {/* Tax Classification */}
      <div className="space-y-3">
        <Label>Federal tax classification *</Label>
        <RadioGroup value={taxClassification} onValueChange={setTaxClassification}>
          {TAX_CLASSIFICATIONS.map((classification) => (
            <div key={classification.value} className="flex items-center space-x-2">
              <RadioGroupItem value={classification.value} id={classification.value} />
              <Label htmlFor={classification.value} className="font-normal cursor-pointer">
                {classification.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label>Address *</Label>
        <Input
          value={formData.address}
          onChange={(e) => onUpdate("address", e.target.value)}
          placeholder="Street address"
          disabled
          className="bg-muted"
        />
        <div className="grid grid-cols-3 gap-2">
          <Input value={formData.city} disabled className="bg-muted" placeholder="City" />
          <Input value={formData.state} disabled className="bg-muted" placeholder="State" />
          <Input value={formData.zip} disabled className="bg-muted" placeholder="ZIP" />
        </div>
        <p className="text-xs text-muted-foreground">
          Address is pre-filled from your business information.
        </p>
      </div>

      {/* Tax ID */}
      <div className="space-y-2">
        <Label>Taxpayer Identification Number (TIN) *</Label>
        <Input
          value={formData.tax_id}
          onChange={(e) => onUpdate("tax_id", e.target.value)}
          placeholder="XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)"
          maxLength={11}
        />
        <p className="text-xs text-muted-foreground">
          Enter your EIN (Employer Identification Number) or SSN (Social Security Number).
        </p>
      </div>

      {/* 1099 Tracking */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="track_1099"
          checked={formData.track_1099}
          onCheckedChange={(checked) => onUpdate("track_1099", checked === true)}
        />
        <Label htmlFor="track_1099" className="font-normal cursor-pointer">
          I expect to receive 1099 forms for payments over $600
        </Label>
      </div>

      {/* Certification */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
        <p className="font-medium">Certification</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Under penalties of perjury, I certify that:
        </p>
        <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
          <li>
            The number shown on this form is my correct taxpayer identification number (or I am
            waiting for a number to be issued to me); and
          </li>
          <li>
            I am not subject to backup withholding because: (a) I am exempt from backup
            withholding, or (b) I have not been notified by the IRS that I am subject to backup
            withholding as a result of a failure to report all interest or dividends, or (c) the
            IRS has notified me that I am no longer subject to backup withholding; and
          </li>
          <li>I am a U.S. citizen or other U.S. person; and</li>
          <li>
            The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA
            reporting is correct.
          </li>
        </ol>
      </div>

      {/* Signature */}
      <div className="space-y-3">
        <Label>Signature *</Label>
        <div className="border rounded-lg p-2 bg-background">
          <SignatureCanvas
            ref={sigCanvasRef}
            canvasProps={{
              className: "w-full h-32 border rounded bg-white",
              style: { width: "100%", height: "128px" },
            }}
            onEnd={handleSaveSignature}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleClearSignature}>
            Clear Signature
          </Button>
          {formData.w9_signature && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="h-4 w-4" />
              Signature captured
            </span>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label>Date</Label>
        <Input value={new Date().toLocaleDateString()} disabled className="bg-muted w-40" />
      </div>
    </div>
  );
}
