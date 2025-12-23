import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { supabase } from "@/integrations/supabase/client";

interface CompanyInfo {
  company_name: string;
  legal_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  tax_id?: string | null;
  phone?: string | null;
}

interface PersonnelInfo {
  first_name: string;
  last_name: string;
  ssn_last_four?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface PaymentData {
  totalNonemployeeCompensation: number;
  federalTaxWithheld: number;
  stateTaxWithheld: number;
  stateIncome: number;
  excessGoldenParachute?: number;
}

export interface Generate1099Options {
  taxYear: number;
  w9Form: W9Form;
  personnel: PersonnelInfo;
  company: CompanyInfo;
  payments: PaymentData;
  isVoid?: boolean;
  isCorrected?: boolean;
  directSales5000Plus?: boolean;
  secondTinNotification?: boolean;
}

export async function downloadForm1099(options: Generate1099Options): Promise<void> {
  const { taxYear, w9Form, personnel, company, payments } = options;

  const response = await supabase.functions.invoke("generate-pdf", {
    body: {
      type: "1099-nec",
      formData: {
        taxYear,
        company: {
          company_name: company.company_name,
          legal_name: company.legal_name,
          address: company.address,
          city: company.city,
          state: company.state,
          zip: company.zip,
          tax_id: company.tax_id,
          phone: company.phone,
        },
        recipient: {
          name: w9Form.name_on_return,
          address: w9Form.address || personnel.address,
          city: w9Form.city || personnel.city,
          state: w9Form.state || personnel.state,
          zip: w9Form.zip || personnel.zip,
          ssn_last_four: personnel.ssn_last_four,
        },
        payments: {
          nonemployeeCompensation: payments.totalNonemployeeCompensation,
          federalTaxWithheld: payments.federalTaxWithheld,
          stateTaxWithheld: payments.stateTaxWithheld,
          stateIncome: payments.stateIncome,
        },
        accountNumber: w9Form.account_numbers,
      },
    },
  });

  if (response.error) {
    throw new Error(`Failed to generate 1099-NEC: ${response.error.message}`);
  }

  // Response data is the PDF bytes
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `1099-NEC_${taxYear}_${personnel.last_name}_${personnel.first_name}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
