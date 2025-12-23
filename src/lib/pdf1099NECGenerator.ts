import { PDFDocument, StandardFonts } from "pdf-lib";

export interface Form1099NECData {
  year: string;
  payerName: string;
  payerAddress: string;
  payerCityStateZip: string;
  payerTIN: string;
  recipientName: string;
  recipientStreetAddress: string;
  recipientCityStateZip: string;
  recipientTIN: string;
  accountNumber?: string;
  nonemployeeCompensation: string;
  federalIncomeTaxWithheld?: string;
  stateTaxWithheld?: string;
  stateIncome?: string;
  statePayerStateNo?: string;
  stateName?: string;
}

// Field name patterns for each copy of the 1099-NEC form
const COPY_PREFIXES = ['CopyA', 'Copy1', 'CopyB', 'Copy2'];

export async function generate1099NECPDF(formData: Form1099NECData): Promise<Blob> {
  const templateUrl = "/forms/1099-nec-fillable.pdf";
  const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // Log available fields for debugging
  const fields = form.getFields();
  console.log("Available 1099-NEC form fields:", fields.map(f => f.getName()));

  // Fill all copies of the form
  for (const copyPrefix of COPY_PREFIXES) {
    fillFormCopy(form, formData, copyPrefix);
  }

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helveticaFont);
  form.flatten();

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

function fillFormCopy(form: ReturnType<PDFDocument['getForm']>, data: Form1099NECData, copyPrefix: string) {
  // Calendar year
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].PgHeader[0].CalendarYear[0].f1_1[0]`, data.year);
  
  // Payer's name and address (combined field or separate)
  const payerInfo = `${data.payerName}\n${data.payerAddress}\n${data.payerCityStateZip}`;
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_2[0]`, payerInfo);
  
  // Payer's TIN
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_3[0]`, formatTIN(data.payerTIN));
  
  // Recipient's TIN
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_4[0]`, formatTIN(data.recipientTIN));
  
  // Recipient's name
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_5[0]`, data.recipientName);
  
  // Recipient's street address
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_6[0]`, data.recipientStreetAddress);
  
  // Recipient's city, state, ZIP
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_7[0]`, data.recipientCityStateZip);
  
  // Account number (if any)
  if (data.accountNumber) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_8[0]`, data.accountNumber);
  }
  
  // Box 1: Nonemployee compensation
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_9[0]`, data.nonemployeeCompensation);
  
  // Box 4: Federal income tax withheld
  if (data.federalIncomeTaxWithheld) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_10[0]`, data.federalIncomeTaxWithheld);
  }
  
  // State information (boxes 5-7)
  if (data.statePayerStateNo) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_11[0]`, data.statePayerStateNo);
  }
  if (data.stateIncome) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_12[0]`, data.stateIncome);
  }
}

function safeSetTextField(form: ReturnType<PDFDocument['getForm']>, fieldName: string, value: string) {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch (e) {
    // Try alternative field name patterns
    const alternativePatterns = [
      fieldName.replace('[0].LeftCol[0]', '[0].LeftCol'),
      fieldName.replace('[0].RightCol[0]', '[0].RightCol'),
      fieldName.replace('f1_', 'f_'),
    ];
    
    for (const altName of alternativePatterns) {
      try {
        const field = form.getTextField(altName);
        field.setText(value);
        return;
      } catch {
        // Continue trying
      }
    }
    console.warn(`Could not fill field ${fieldName}:`, e);
  }
}

function formatTIN(tin: string): string {
  const clean = tin.replace(/\D/g, '');
  if (clean.length === 9) {
    // Format as SSN: XXX-XX-XXXX or EIN: XX-XXXXXXX
    if (clean.startsWith('9')) {
      // Likely EIN
      return `${clean.substring(0, 2)}-${clean.substring(2)}`;
    }
    return `${clean.substring(0, 3)}-${clean.substring(3, 5)}-${clean.substring(5)}`;
  }
  return tin;
}

export async function download1099NECPDF(formData: Form1099NECData, fileName?: string): Promise<void> {
  const blob = await generate1099NECPDF(formData);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || `1099-NEC_${formData.year}_${formData.recipientName.replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
