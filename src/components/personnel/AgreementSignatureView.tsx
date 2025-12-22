import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Check, X, Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { W9FormPreview } from "./W9FormPreview";
import { ICAFormPreview } from "./ICAFormPreview";
import { downloadICAForm } from "@/lib/generateICA";

interface AgreementSignatureViewProps {
  icaSignature?: string | null;
  icaSignedAt?: string | null;
  w9Signature?: string | null;
  w9SignedAt?: string | null;
  personnelName?: string;
  personnelAddress?: string;
  w9Form?: W9Form | null;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

export function AgreementSignatureView({
  icaSignature,
  icaSignedAt,
  w9Signature,
  w9SignedAt,
  personnelName,
  personnelAddress,
  w9Form,
  ssnLastFour,
  ssnFull,
}: AgreementSignatureViewProps) {
  const [showAgreement, setShowAgreement] = useState(false);
  const [showW9, setShowW9] = useState(false);

  const hasIcaSigned = !!icaSignature && !!icaSignedAt;
  const hasW9Signed = !!w9Signature && !!w9SignedAt;
  const hasW9Form = !!w9Form;

  const renderSignature = (signature: string | null | undefined, label: string) => {
    if (!signature) return null;
    
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <label className="text-xs font-medium text-muted-foreground block mb-2">{label}</label>
        {signature.startsWith("data:image") ? (
          <img 
            src={signature} 
            alt={label}
            className="max-h-20 object-contain"
          />
        ) : (
          <p className="font-signature text-xl italic">{signature}</p>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreement Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Independent Contractor Agreement */}
          <div>
            <h4 className="font-semibold mb-3">Independent Contractor Agreement (ICA)</h4>
            {hasIcaSigned ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-600 gap-1">
                    <Check className="h-3 w-3" />
                    Agreement Signed
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setShowAgreement(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Agreement
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Signed on {format(new Date(icaSignedAt), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
                {renderSignature(icaSignature, "ICA Signature")}
              </div>
            ) : (
              <div className="py-4">
                <Badge variant="outline" className="gap-1">
                  <X className="h-3 w-3" />
                  Not Signed
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  The contractor has not signed the Independent Contractor Agreement yet.
                </p>
              </div>
            )}
          </div>

          {/* W-9 Form Signature */}
          <div className="border-t pt-6">
            <h4 className="font-semibold mb-3">W-9 Form</h4>
            {hasW9Signed || hasW9Form ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-600 gap-1">
                    <Check className="h-3 w-3" />
                    W-9 Completed
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setShowW9(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View W-9 Form
                  </Button>
                </div>
                {w9SignedAt && (
                  <p className="text-sm text-muted-foreground">
                    Signed on {format(new Date(w9SignedAt), "MMMM dd, yyyy 'at' h:mm a")}
                  </p>
                )}
                {!hasW9Form && renderSignature(w9Signature, "W-9 Signature")}
              </div>
            ) : (
              <div className="py-4">
                <Badge variant="outline" className="gap-1">
                  <X className="h-3 w-3" />
                  Not Completed
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  The contractor has not completed the W-9 form yet.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full ICA Agreement Dialog */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Independent Contractor Agreement
            </DialogTitle>
          </DialogHeader>
          <ICAFormPreview 
            data={{
              contractorName: personnelName || 'Contractor',
              contractorAddress: personnelAddress,
              signature: icaSignature,
              signedAt: icaSignedAt,
            }}
          />
        </DialogContent>
      </Dialog>

      {/* W-9 Form Preview Dialog */}
      <Dialog open={showW9} onOpenChange={setShowW9}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Form W-9 (Request for Taxpayer Identification Number)
            </DialogTitle>
          </DialogHeader>
          {w9Form ? (
            <W9FormPreview 
              w9Form={w9Form} 
              ssnLastFour={ssnLastFour}
              ssnFull={ssnFull}
            />
          ) : (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                The W-9 (Request for Taxpayer Identification Number and Certification) form was signed by the contractor to provide their TIN for tax reporting purposes.
              </p>
              
              <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Contractor Name</p>
                  <p className="font-medium">{personnelName || "N/A"}</p>
                </div>
                
                {personnelAddress && (
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">{personnelAddress}</p>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Signature</p>
                  {w9Signature?.startsWith("data:image") ? (
                    <img 
                      src={w9Signature} 
                      alt="W-9 Signature"
                      className="max-h-16 object-contain"
                    />
                  ) : (
                    <p className="font-signature text-xl italic">{w9Signature}</p>
                  )}
                  {w9SignedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Signed on {format(new Date(w9SignedAt), "MMMM dd, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                For complete W-9 details including TIN information, view the Tax Info tab.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
