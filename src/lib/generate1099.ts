import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { generate1099NECPDF, Form1099NECData } from "./pdf1099NECGenerator";

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
  ssn_full?: string | null;
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

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

export async function downloadForm1099(options: Generate1099Options): Promise<void> {
  const { taxYear, w9Form, personnel, company, payments } = options;

  // Build payer (company) info
  const payerName = company.legal_name || company.company_name;
  const payerAddress = company.address || "";
  const payerCityStateZip = [company.city, company.state, company.zip].filter(Boolean).join(", ");
  const payerTIN = company.tax_id || "";

  // Build recipient info from W-9 form data
  const recipientName = w9Form.name_on_return || `${personnel.first_name} ${personnel.last_name}`;
  const recipientStreetAddress = w9Form.address || personnel.address || "";
  const recipientCityStateZip = [
    w9Form.city || personnel.city,
    w9Form.state || personnel.state,
    w9Form.zip || personnel.zip
  ].filter(Boolean).join(", ");
  
  // Use full SSN if available, otherwise format with last 4
  let recipientTIN = "";
  if (personnel.ssn_full) {
    recipientTIN = personnel.ssn_full;
  } else if (personnel.ssn_last_four) {
    recipientTIN = `XXX-XX-${personnel.ssn_last_four}`;
  }

  const formData: Form1099NECData = {
    year: taxYear.toString(),
    payerName,
    payerAddress,
    payerCityStateZip,
    payerTIN,
    recipientName,
    recipientStreetAddress,
    recipientCityStateZip,
    recipientTIN,
    accountNumber: w9Form.account_numbers || undefined,
    nonemployeeCompensation: formatCurrency(payments.totalNonemployeeCompensation),
    federalIncomeTaxWithheld: payments.federalTaxWithheld > 0 ? formatCurrency(payments.federalTaxWithheld) : undefined,
    stateTaxWithheld: payments.stateTaxWithheld > 0 ? formatCurrency(payments.stateTaxWithheld) : undefined,
    stateIncome: payments.stateIncome > 0 ? formatCurrency(payments.stateIncome) : undefined,
  };

  const blob = await generate1099NECPDF(formData);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `1099-NEC_${taxYear}_${personnel.last_name}_${personnel.first_name}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
