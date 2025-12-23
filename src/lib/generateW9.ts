import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { generateW9PDF, W9PDFFormData } from "./pdfGenerator";

export interface GenerateW9Options {
  w9Form: W9Form;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

function buildW9FormData(options: GenerateW9Options): W9PDFFormData {
  const { w9Form, ssnFull, ssnLastFour } = options;
  
  // Determine TIN value - prefer full SSN, fall back to EIN, then last four
  let tin = "";
  let tinType: "ssn" | "ein" = "ssn";
  
  if (w9Form.tin_type === "ein" && w9Form.ein) {
    tin = w9Form.ein;
    tinType = "ein";
  } else if (ssnFull) {
    tin = ssnFull;
    tinType = "ssn";
  } else if (ssnLastFour) {
    tin = `XXX-XX-${ssnLastFour}`;
    tinType = "ssn";
  }
  
  const cityStateZip = [w9Form.city, w9Form.state, w9Form.zip].filter(Boolean).join(", ");
  
  return {
    name: w9Form.name_on_return || "",
    businessName: w9Form.business_name || undefined,
    taxClassification: w9Form.federal_tax_classification || "individual",
    llcTaxCode: w9Form.llc_tax_classification || undefined,
    otherTaxClassification: w9Form.other_classification || undefined,
    exemptPayeeCode: w9Form.exempt_payee_code || undefined,
    fatcaExemptionCode: w9Form.fatca_exemption_code || undefined,
    address: w9Form.address || "",
    cityStateZip,
    accountNumbers: w9Form.account_numbers || undefined,
    tinType,
    tin,
    signatureData: w9Form.signature_data || undefined,
    signatureDate: w9Form.signature_date ? new Date(w9Form.signature_date).toLocaleDateString() : undefined,
  };
}

export async function downloadFormW9(options: GenerateW9Options): Promise<void> {
  const formData = buildW9FormData(options);
  
  const blob = await generateW9PDF(formData);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `W-9_${options.w9Form.name_on_return?.replace(/\s+/g, "_") || "form"}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getW9Blob(options: GenerateW9Options): Promise<Blob> {
  const formData = buildW9FormData(options);
  return generateW9PDF(formData);
}
