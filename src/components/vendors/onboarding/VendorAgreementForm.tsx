import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSignature, Check } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

interface VendorAgreementFormProps {
  vendorName: string;
  signature: string | null;
  onUpdate: (signature: string | null) => void;
}

export function VendorAgreementForm({ vendorName, signature, onUpdate }: VendorAgreementFormProps) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const handleClearSignature = () => {
    sigCanvasRef.current?.clear();
    onUpdate(null);
  };

  const handleSaveSignature = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const signatureData = sigCanvasRef.current.toDataURL("image/png");
      onUpdate(signatureData);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileSignature className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Vendor Agreement</p>
              <p className="text-xs text-muted-foreground">
                Please review and sign the vendor agreement below to complete your registration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreement Content */}
      <div className="space-y-2">
        <Label>Vendor Services Agreement</Label>
        <ScrollArea className="h-[300px] border rounded-lg p-4 bg-muted/30">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h3 className="text-foreground">VENDOR SERVICES AGREEMENT</h3>
            
            <p>
              This Vendor Services Agreement ("Agreement") is entered into by and between Fairfield
              Resource Group ("Company") and <strong>{vendorName || "[Vendor Name]"}</strong> ("Vendor").
            </p>

            <h4 className="text-foreground">1. SERVICES</h4>
            <p>
              Vendor agrees to provide goods and/or services as specified in individual purchase
              orders or work orders issued by Company.
            </p>

            <h4 className="text-foreground">2. COMPENSATION</h4>
            <p>
              Company shall compensate Vendor at the rates specified in the applicable purchase
              order or as otherwise agreed in writing. Payment terms are Net 30 unless otherwise
              specified.
            </p>

            <h4 className="text-foreground">3. INDEPENDENT CONTRACTOR STATUS</h4>
            <p>
              Vendor is an independent contractor and not an employee, partner, or joint venturer
              of Company. Vendor shall be responsible for all taxes arising from compensation for
              services.
            </p>

            <h4 className="text-foreground">4. INSURANCE</h4>
            <p>
              Vendor shall maintain appropriate insurance coverage, including general liability
              insurance with minimum coverage of $1,000,000 per occurrence, and shall provide
              certificates of insurance upon request.
            </p>

            <h4 className="text-foreground">5. CONFIDENTIALITY</h4>
            <p>
              Vendor agrees to maintain the confidentiality of all proprietary information,
              business plans, customer lists, and other confidential information of Company.
            </p>

            <h4 className="text-foreground">6. COMPLIANCE</h4>
            <p>
              Vendor shall comply with all applicable federal, state, and local laws and
              regulations in the performance of services.
            </p>

            <h4 className="text-foreground">7. TERMINATION</h4>
            <p>
              Either party may terminate this Agreement with 30 days written notice. Company may
              terminate immediately for cause.
            </p>

            <h4 className="text-foreground">8. INDEMNIFICATION</h4>
            <p>
              Vendor shall indemnify and hold harmless Company from any claims, damages, or
              liabilities arising from Vendor's performance of services under this Agreement.
            </p>

            <p className="mt-6">
              By signing below, Vendor acknowledges that they have read, understand, and agree to
              be bound by the terms and conditions of this Agreement.
            </p>
          </div>
        </ScrollArea>
      </div>

      {/* Signature */}
      <div className="space-y-3">
        <Label>Signature *</Label>
        <p className="text-sm text-muted-foreground">
          By signing below, I acknowledge that I have read and agree to the terms of this Vendor
          Services Agreement.
        </p>
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
          {signature && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="h-4 w-4" />
              Signature captured
            </span>
          )}
        </div>
      </div>

      {/* Date and Name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Printed Name</Label>
          <div className="p-2 bg-muted rounded-md text-sm">{vendorName || "—"}</div>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <div className="p-2 bg-muted rounded-md text-sm">{new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}
