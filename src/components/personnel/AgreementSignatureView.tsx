import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, X } from "lucide-react";
import { format } from "date-fns";

interface AgreementSignatureViewProps {
  icaSignature?: string | null;
  icaSignedAt?: string | null;
  w9Signature?: string | null;
  w9SignedAt?: string | null;
}

export function AgreementSignatureView({
  icaSignature,
  icaSignedAt,
  w9Signature,
  w9SignedAt,
}: AgreementSignatureViewProps) {
  const hasIcaSigned = !!icaSignature && !!icaSignedAt;
  const hasW9Signed = !!w9Signature && !!w9SignedAt;

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
              <Badge className="bg-green-600 gap-1">
                <Check className="h-3 w-3" />
                Agreement Signed
              </Badge>
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
          <h4 className="font-semibold mb-3">W-9 Form Signature</h4>
          {hasW9Signed ? (
            <div className="space-y-3">
              <Badge className="bg-green-600 gap-1">
                <Check className="h-3 w-3" />
                W-9 Signed
              </Badge>
              <p className="text-sm text-muted-foreground">
                Signed on {format(new Date(w9SignedAt), "MMMM dd, yyyy 'at' h:mm a")}
              </p>
              {renderSignature(w9Signature, "W-9 Signature")}
            </div>
          ) : (
            <div className="py-4">
              <Badge variant="outline" className="gap-1">
                <X className="h-3 w-3" />
                Not Signed
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                The contractor has not signed the W-9 form yet.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
