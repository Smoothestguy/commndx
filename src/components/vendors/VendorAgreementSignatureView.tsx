import { useState, useMemo } from "react";
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
import { downloadVendorAgreement } from "@/lib/generateVendorAgreement";
import { W9FormPreview } from "@/components/personnel/W9FormPreview";
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";

interface VendorAgreementSignatureViewProps {
  vendorName: string;
  companyName?: string | null;
  vendorAddress?: string | null;
  vendorAgreementSignature?: string | null;
  vendorAgreementSignedAt?: string | null;
  w9Signature?: string | null;
  w9SignedAt?: string | null;
  taxId?: string | null;
  federalTaxClassification?: string | null;
}

export function VendorAgreementSignatureView({
  vendorName,
  companyName,
  vendorAddress,
  vendorAgreementSignature,
  vendorAgreementSignedAt,
  w9Signature,
  w9SignedAt,
  taxId,
  federalTaxClassification,
}: VendorAgreementSignatureViewProps) {
  const [showAgreement, setShowAgreement] = useState(false);
  const [showW9, setShowW9] = useState(false);

  const hasAgreementSigned = !!vendorAgreementSignature && !!vendorAgreementSignedAt;
  const hasW9Signed = !!w9Signature && !!w9SignedAt;

  const w9FormData = useMemo<W9Form>(() => ({
    id: "vendor-w9",
    personnel_id: "",
    name_on_return: vendorName,
    business_name: companyName || null,
    federal_tax_classification: federalTaxClassification || "individual",
    llc_tax_classification: null,
    other_classification: null,
    has_foreign_partners: false,
    exempt_payee_code: null,
    fatca_exemption_code: null,
    address: vendorAddress || "",
    city: "",
    state: "",
    zip: "",
    account_numbers: null,
    tin_type: "ein" as const,
    ein: taxId || null,
    signature_data: w9Signature || null,
    signature_date: w9SignedAt || new Date().toISOString(),
    certified_us_person: true,
    certified_correct_tin: true,
    certified_not_subject_backup_withholding: true,
    certified_fatca_exempt: false,
    document_url: null,
    status: "completed" as const,
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    edit_allowed: false,
    edit_allowed_until: null,
    created_at: w9SignedAt || new Date().toISOString(),
    updated_at: w9SignedAt || new Date().toISOString(),
  }), [vendorName, companyName, federalTaxClassification, vendorAddress, taxId, w9Signature, w9SignedAt]);

  const handleDownloadAgreement = () => {
    downloadVendorAgreement({
      vendorName,
      companyName,
      vendorAddress,
      signature: vendorAgreementSignature,
      signedAt: vendorAgreementSignedAt,
    });
  };

  const renderSignature = (signature: string | null | undefined, label: string) => {
    if (!signature) return null;
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <label className="text-xs font-medium text-muted-foreground block mb-2">{label}</label>
        {signature.startsWith("data:image") ? (
          <img src={signature} alt={label} className="max-h-20 object-contain" />
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
          {/* Vendor Agreement */}
          <div>
            <h4 className="font-semibold mb-3">Vendor Agreement</h4>
            {hasAgreementSigned ? (
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
                  Signed on {format(new Date(vendorAgreementSignedAt), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
                {renderSignature(vendorAgreementSignature, "Vendor Agreement Signature")}
              </div>
            ) : (
              <div className="py-4">
                <Badge variant="outline" className="gap-1">
                  <X className="h-3 w-3" />
                  Not Signed
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  The vendor has not signed the Vendor Agreement yet.
                </p>
              </div>
            )}
          </div>

          {/* W-9 */}
          <div className="border-t pt-6">
            <h4 className="font-semibold mb-3">W-9 Form</h4>
            {hasW9Signed ? (
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
                <p className="text-sm text-muted-foreground">
                  Signed on {format(new Date(w9SignedAt), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
                {renderSignature(w9Signature, "W-9 Signature")}
              </div>
            ) : (
              <div className="py-4">
                <Badge variant="outline" className="gap-1">
                  <X className="h-3 w-3" />
                  Not Completed
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  The vendor has not completed the W-9 form yet.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vendor Agreement Dialog */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vendor Agreement
            </DialogTitle>
          </DialogHeader>
          <div className="w-full">
            <div className="flex justify-end mb-4">
              <Button onClick={handleDownloadAgreement} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
            <ScrollArea className="h-[65vh]">
              <div className="bg-white text-black p-6 text-sm" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
                {/* Fairfield Header */}
                <div className="text-center mb-6">
                  <div className="text-4xl font-black tracking-wider text-gray-300 leading-none">FAIRFIELD</div>
                  <div className="flex items-center justify-center mt-[-6px]">
                    <div className="w-52 h-6 bg-gradient-to-r from-gray-300 to-transparent"></div>
                    <div className="text-xl font-light tracking-widest text-gray-300 ml-2">GROUP</div>
                  </div>
                </div>

                <div className="text-center border-b pb-4 mb-4">
                  <h1 className="text-lg font-bold">VENDOR AGREEMENT</h1>
                  <p className="text-muted-foreground text-xs mt-1">
                    {vendorAgreementSignedAt
                      ? `This Agreement is entered into as of ${format(new Date(vendorAgreementSignedAt), "MMMM dd, yyyy")}`
                      : 'This Agreement is entered into as of the date signed below'}
                  </p>
                </div>

                <section className="mb-4">
                  <p className="font-bold mb-2">PARTIES:</p>
                  <p><strong>Company:</strong> Fairfield Response Group LLC</p>
                  <p><strong>Vendor:</strong> {vendorName}</p>
                  {companyName && <p><strong>DBA / Company:</strong> {companyName}</p>}
                  {vendorAddress && <p><strong>Address:</strong> {vendorAddress}</p>}
                </section>

                <div className="space-y-4">
                  {[
                    { title: '1. SCOPE OF SERVICES', content: 'The Vendor agrees to provide goods and/or services to the Company as described in individual purchase orders, work orders, or other written agreements. All services shall be performed in a professional and workmanlike manner consistent with industry standards.' },
                    { title: '2. INDEPENDENT CONTRACTOR STATUS', content: 'The Vendor is an independent contractor and not an employee, partner, or agent of the Company. The Vendor shall be solely responsible for the means, methods, and manner of performing services. The Vendor is responsible for paying all applicable taxes and maintaining appropriate insurance coverage.' },
                    { title: '3. COMPENSATION AND PAYMENT', content: "The Company shall compensate the Vendor at the rates specified in applicable purchase orders or as otherwise agreed upon in writing. Payment shall be made according to the payment terms established for the Vendor account." },
                    { title: '4. INSURANCE AND LICENSING', content: "The Vendor shall maintain all required licenses, permits, and insurance coverage necessary for the performance of services. The Vendor shall provide proof of insurance upon request and shall maintain coverage for the duration of any active engagement." },
                    { title: '5. CONFIDENTIALITY', content: 'The Vendor agrees to keep confidential all proprietary information, trade secrets, client information, and business information of the Company. This obligation shall survive the termination of this Agreement.' },
                    { title: '6. INDEMNIFICATION', content: 'The Vendor shall indemnify and hold harmless the Company, its officers, employees, and agents from any claims, damages, losses, or expenses arising from the Vendor\'s performance of services or breach of this Agreement.' },
                    { title: '7. COMPLIANCE', content: 'The Vendor shall comply with all applicable federal, state, and local laws, regulations, and ordinances in the performance of services under this Agreement.' },
                    { title: '8. TERMINATION', content: 'Either party may terminate this Agreement at any time, with or without cause, upon written notice to the other party. Termination shall not affect obligations arising prior to the termination date.' },
                    { title: '9. GOVERNING LAW', content: 'This Agreement shall be governed by and construed in accordance with the laws of the state in which the Company is located.' },
                  ].map((section, index) => (
                    <section key={index}>
                      <p className="font-bold">{section.title}</p>
                      <p className="text-justify leading-relaxed">{section.content}</p>
                    </section>
                  ))}
                </div>

                {vendorAgreementSignature && vendorAgreementSignedAt && (
                  <section className="border-t pt-6 mt-6">
                    <p className="font-bold mb-4">SIGNATURE</p>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Vendor Signature</p>
                      {vendorAgreementSignature.startsWith("data:image") ? (
                        <img src={vendorAgreementSignature} alt="Vendor Agreement Signature" className="max-h-16 object-contain" />
                      ) : (
                        <p className="font-signature text-xl italic">{vendorAgreementSignature}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">
                        Signed on {format(new Date(vendorAgreementSignedAt), "MMMM dd, yyyy 'at' h:mm a")}
                      </p>
                      <p className="text-xs mt-2"><strong>Vendor Name:</strong> {vendorName}</p>
                      {companyName && <p className="text-xs mt-1"><strong>Company:</strong> {companyName}</p>}
                    </div>
                  </section>
                )}

                <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
                  Fairfield Response Group LLC - Vendor Agreement
                </div>
              </div>
            </ScrollArea>
          </div>
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
          <W9FormPreview w9Form={w9FormData} />
        </DialogContent>
      </Dialog>
    </>
  );
}
