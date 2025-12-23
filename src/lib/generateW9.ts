import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { supabase } from "@/integrations/supabase/client";

export interface GenerateW9Options {
  w9Form: W9Form;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

export async function downloadFormW9(options: GenerateW9Options): Promise<void> {
  const { w9Form, ssnLastFour, ssnFull } = options;

  const response = await supabase.functions.invoke("generate-pdf", {
    body: {
      type: "w9",
      formData: {
        name_on_return: w9Form.name_on_return,
        business_name: w9Form.business_name,
        federal_tax_classification: w9Form.federal_tax_classification,
        llc_tax_classification: w9Form.llc_tax_classification,
        other_classification: w9Form.other_classification,
        exempt_payee_code: w9Form.exempt_payee_code,
        fatca_exemption_code: w9Form.fatca_exemption_code,
        address: w9Form.address,
        city: w9Form.city,
        state: w9Form.state,
        zip: w9Form.zip,
        account_numbers: w9Form.account_numbers,
        tin_type: w9Form.tin_type,
        ein: w9Form.ein,
        signature_data: w9Form.signature_data,
        signature_date: w9Form.signature_date,
        has_foreign_partners: w9Form.has_foreign_partners,
      },
      ssnFull,
      ssnLastFour,
    },
  });

  if (response.error) {
    throw new Error(`Failed to generate W-9: ${response.error.message}`);
  }

  // Response data is the PDF bytes
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `W-9_${w9Form.name_on_return?.replace(/\s+/g, "_") || "form"}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getW9Blob(options: GenerateW9Options): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const { w9Form, ssnLastFour, ssnFull } = options;

      const response = await supabase.functions.invoke("generate-pdf", {
        body: {
          type: "w9",
          formData: {
            name_on_return: w9Form.name_on_return,
            business_name: w9Form.business_name,
            federal_tax_classification: w9Form.federal_tax_classification,
            llc_tax_classification: w9Form.llc_tax_classification,
            other_classification: w9Form.other_classification,
            exempt_payee_code: w9Form.exempt_payee_code,
            fatca_exemption_code: w9Form.fatca_exemption_code,
            address: w9Form.address,
            city: w9Form.city,
            state: w9Form.state,
            zip: w9Form.zip,
            account_numbers: w9Form.account_numbers,
            tin_type: w9Form.tin_type,
            ein: w9Form.ein,
            signature_data: w9Form.signature_data,
            signature_date: w9Form.signature_date,
            has_foreign_partners: w9Form.has_foreign_partners,
          },
          ssnFull,
          ssnLastFour,
        },
      });

      if (response.error) {
        throw new Error(`Failed to generate W-9: ${response.error.message}`);
      }

      const blob = new Blob([response.data], { type: "application/pdf" });
      resolve(blob);
    } catch (error) {
      reject(error);
    }
  });
}
