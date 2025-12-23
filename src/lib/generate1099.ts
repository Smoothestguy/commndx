import { PDFDocument } from 'pdf-lib';
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";

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

// Format currency for display
const formatCurrency = (amount: number): string => {
  return amount.toFixed(2);
};

// Mask SSN for display
const maskSSN = (ssnLastFour: string | null | undefined): string => {
  if (!ssnLastFour) return "";
  return `XXX-XX-${ssnLastFour}`;
};

// Format tax ID for display
const formatTaxId = (taxId: string | null | undefined): string => {
  if (!taxId) return "";
  const digits = taxId.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  }
  return taxId;
};

export async function generate1099NEC(options: Generate1099Options): Promise<Uint8Array> {
  const { 
    taxYear, 
    w9Form, 
    personnel, 
    company, 
    payments,
    isVoid = false,
    isCorrected = false,
    directSales5000Plus = false,
    secondTinNotification = false
  } = options;

  // Fetch the fillable 1099-NEC template
  const templateUrl = '/forms/1099-nec-fillable.pdf';
  const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
  
  // Load the PDF
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  
  // Get all field names for debugging - you can uncomment this to see available fields
  // const fields = form.getFields();
  // console.log('1099-NEC Form fields:', fields.map(f => `${f.getName()} (${f.constructor.name})`));

  // VOID checkbox
  if (isVoid) {
    try {
      const voidCheckbox = form.getCheckBox('c1_1[0]');
      if (voidCheckbox) voidCheckbox.check();
    } catch (e) { console.warn('VOID checkbox not found'); }
  }

  // CORRECTED checkbox
  if (isCorrected) {
    try {
      const correctedCheckbox = form.getCheckBox('c1_2[0]');
      if (correctedCheckbox) correctedCheckbox.check();
    } catch (e) { console.warn('CORRECTED checkbox not found'); }
  }

  // Tax Year
  try {
    const yearField = form.getTextField('f1_1[0]');
    if (yearField) {
      yearField.setText(taxYear.toString());
    }
  } catch (e) { console.warn('Year field not found'); }

  // PAYER'S name, address
  try {
    const payerNameField = form.getTextField('f1_2[0]');
    if (payerNameField) {
      const payerInfo = [
        company.legal_name || company.company_name,
        company.address,
        [company.city, company.state, company.zip].filter(Boolean).join(', '),
        company.phone
      ].filter(Boolean).join('\n');
      payerNameField.setText(payerInfo);
    }
  } catch (e) { console.warn('Payer name field not found'); }

  // PAYER'S TIN
  try {
    const payerTinField = form.getTextField('f1_3[0]');
    if (payerTinField) {
      payerTinField.setText(formatTaxId(company.tax_id));
    }
  } catch (e) { console.warn('Payer TIN field not found'); }

  // RECIPIENT'S TIN
  try {
    const recipientTinField = form.getTextField('f1_4[0]');
    if (recipientTinField) {
      recipientTinField.setText(maskSSN(personnel.ssn_last_four));
    }
  } catch (e) { console.warn('Recipient TIN field not found'); }

  // RECIPIENT'S name
  try {
    const recipientNameField = form.getTextField('f1_5[0]');
    if (recipientNameField) {
      recipientNameField.setText(w9Form.name_on_return);
    }
  } catch (e) { console.warn('Recipient name field not found'); }

  // Street address
  try {
    const addressField = form.getTextField('f1_6[0]');
    if (addressField) {
      addressField.setText(w9Form.address || personnel.address || '');
    }
  } catch (e) { console.warn('Address field not found'); }

  // City, state, ZIP
  try {
    const cityField = form.getTextField('f1_7[0]');
    if (cityField) {
      const cityStateZip = [
        w9Form.city || personnel.city,
        w9Form.state || personnel.state,
        w9Form.zip || personnel.zip
      ].filter(Boolean).join(', ');
      cityField.setText(cityStateZip);
    }
  } catch (e) { console.warn('City field not found'); }

  // Account number
  try {
    const accountField = form.getTextField('f1_8[0]');
    if (accountField && w9Form.account_numbers) {
      accountField.setText(w9Form.account_numbers);
    }
  } catch (e) { console.warn('Account field not found'); }

  // Box 1 - Nonemployee compensation
  try {
    const box1Field = form.getTextField('f1_9[0]');
    if (box1Field) {
      box1Field.setText(formatCurrency(payments.totalNonemployeeCompensation));
    }
  } catch (e) { console.warn('Box 1 field not found'); }

  // Box 2 - Payer made direct sales checkbox
  if (directSales5000Plus) {
    try {
      const box2Checkbox = form.getCheckBox('c1_3[0]');
      if (box2Checkbox) box2Checkbox.check();
    } catch (e) { console.warn('Box 2 checkbox not found'); }
  }

  // 2nd TIN notification checkbox
  if (secondTinNotification) {
    try {
      const tinNotCheckbox = form.getCheckBox('c1_4[0]');
      if (tinNotCheckbox) tinNotCheckbox.check();
    } catch (e) { console.warn('2nd TIN checkbox not found'); }
  }

  // Box 3 - Excess golden parachute
  if (payments.excessGoldenParachute && payments.excessGoldenParachute > 0) {
    try {
      const box3Field = form.getTextField('f1_10[0]');
      if (box3Field) {
        box3Field.setText(formatCurrency(payments.excessGoldenParachute));
      }
    } catch (e) { console.warn('Box 3 field not found'); }
  }

  // Box 4 - Federal income tax withheld
  try {
    const box4Field = form.getTextField('f1_11[0]');
    if (box4Field && payments.federalTaxWithheld > 0) {
      box4Field.setText(formatCurrency(payments.federalTaxWithheld));
    }
  } catch (e) { console.warn('Box 4 field not found'); }

  // Box 5 - State tax withheld
  try {
    const box5Field = form.getTextField('f1_12[0]');
    if (box5Field && payments.stateTaxWithheld > 0) {
      box5Field.setText(formatCurrency(payments.stateTaxWithheld));
    }
  } catch (e) { console.warn('Box 5 field not found'); }

  // Box 6 - State/Payer's state no.
  try {
    const box6Field = form.getTextField('f1_13[0]');
    if (box6Field && company.state) {
      box6Field.setText(company.state);
    }
  } catch (e) { console.warn('Box 6 field not found'); }

  // Box 7 - State income
  try {
    const box7Field = form.getTextField('f1_14[0]');
    if (box7Field && payments.stateIncome > 0) {
      box7Field.setText(formatCurrency(payments.stateIncome));
    }
  } catch (e) { console.warn('Box 7 field not found'); }

  // Flatten the form to make it non-editable (optional)
  // form.flatten();

  // Save and return
  return await pdfDoc.save();
}

// Download the generated PDF
export async function downloadForm1099(options: Generate1099Options): Promise<void> {
  const pdfBytes = await generate1099NEC(options);
  const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const fileName = `1099-NEC_${options.taxYear}_${options.personnel.last_name}_${options.personnel.first_name}.pdf`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
