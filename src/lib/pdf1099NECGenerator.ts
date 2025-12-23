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

const COPY_PREFIXES = ["CopyA", "Copy1", "CopyB", "Copy2"];

export async function generate1099NECPDF(formData: Form1099NECData): Promise<Blob> {
  const templateUrl = "/forms/1099-nec-fillable.pdf";
  const existingPdfBytes = await fetch(templateUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  const fields = form.getFields();
  console.log("Available 1099-NEC form fields:", fields.map((f) => f.getName()));

  for (const copyPrefix of COPY_PREFIXES) {
    fillFormCopy(form, formData, copyPrefix);
  }

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helveticaFont);
  form.flatten();

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

function fillFormCopy(
  form: ReturnType<PDFDocument["getForm"]>,
  data: Form1099NECData,
  copyPrefix: string
): void {
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].PgHeader[0].CalendarYear[0].f1_1[0]`, data.year);

  const payerInfo = `${data.payerName}\n${data.payerAddress}\n${data.payerCityStateZip}`;
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_2[0]`, payerInfo);

  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_3[0]`, formatTIN(data.payerTIN));
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_4[0]`, formatTIN(data.recipientTIN));
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_5[0]`, data.recipientName);
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_6[0]`, data.recipientStreetAddress);
  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_7[0]`, data.recipientCityStateZip);

  if (data.accountNumber) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].LeftCol[0].f1_8[0]`, data.accountNumber);
  }

  safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_9[0]`, data.nonemployeeCompensation);

  if (data.federalIncomeTaxWithheld) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_10[0]`, data.federalIncomeTaxWithheld);
  }

  if (data.statePayerStateNo) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_11[0]`, data.statePayerStateNo);
  }

  if (data.stateIncome) {
    safeSetTextField(form, `topmostSubform[0].${copyPrefix}[0].RightCol[0].f1_12[0]`, data.stateIncome);
  }
}

function safeSetTextField(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldName: string,
  value: string
): void {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch {
    console.warn(`Could not fill field ${fieldName}`);
  }
}

function formatTIN(tin: string): string {
  const clean = tin.replace(/\D/g, "");
  if (clean.length === 9) {
    if (clean.startsWith("9")) {
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
