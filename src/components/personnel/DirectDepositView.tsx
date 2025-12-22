import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CreditCard, Check, X } from "lucide-react";
import { format } from "date-fns";

interface DirectDepositViewProps {
  bankName?: string | null;
  accountType?: string | null;
  routingNumber?: string | null;
  accountNumber?: string | null;
  signature?: string | null;
  signedAt?: string | null;
}

export function DirectDepositView({
  bankName,
  accountType,
  routingNumber,
  accountNumber,
  signature,
  signedAt,
}: DirectDepositViewProps) {
  const hasDirectDeposit = bankName || routingNumber || accountNumber;
  const isSigned = !!signature && !!signedAt;

  const maskNumber = (num: string | null | undefined) => {
    if (!num) return null;
    if (num.length <= 4) return num;
    return "****" + num.slice(-4);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Direct Deposit Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasDirectDeposit ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
                <p className="font-medium">{bankName || "Not provided"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                <p className="font-medium capitalize">{accountType || "Not provided"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Routing Number</label>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="font-mono">{maskNumber(routingNumber) || "Not provided"}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="font-mono">{maskNumber(accountNumber) || "Not provided"}</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <label className="text-sm font-medium text-muted-foreground">Authorization Status</label>
              <div className="mt-2">
                {isSigned ? (
                  <div className="space-y-3">
                    <Badge className="bg-green-600 gap-1">
                      <Check className="h-3 w-3" />
                      Authorization Signed
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Signed on {format(new Date(signedAt), "MMMM dd, yyyy 'at' h:mm a")}
                    </p>
                    {signature && (
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <label className="text-xs font-medium text-muted-foreground block mb-2">Signature</label>
                        {signature.startsWith("data:image") ? (
                          <img 
                            src={signature} 
                            alt="Direct Deposit Authorization Signature" 
                            className="max-h-20 object-contain"
                          />
                        ) : (
                          <p className="font-signature text-xl italic">{signature}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <X className="h-3 w-3" />
                    Not Signed
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No direct deposit information on file</p>
            <p className="text-sm mt-1">The employee has not submitted banking details yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
