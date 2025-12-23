// PDF Generator for 1099-NEC forms - v2
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

function safeSetTextField(
  form: ReturnType<typeof PDFDocument.prototype.getForm>,
  fieldName: string,
  value: string
): void {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch (error) {
    console.warn("Could not fill field " + fieldName);
  }
}

function formatTIN(tin: string): string {
  const clean = tin.replace(/\D/g, "");
  if (clean.length === 9) {
    if (clean.startsWith("9")) {
      return clean.substring(0, 2) + "-" + clean.substring(2);
    }
    return clean.substring(0, 3) + "-" + clean.substring(3, 5) + "-" + clean.substring(5);
  }
  return tin;
}

function fillFormCopy(
  form: ReturnType<typeof PDFDocument.prototype.getForm>,
  data: Form1099NECData,
  copyPrefix: string
): void {
  const basePrefix = "topmostSubform[0]." + copyPrefix + "[0]";
  
  safeSetTextField(form, basePrefix + ".PgHeader[0].CalendarYear[0].f1_1[0]", data.year);

  const payerInfo = data.payerName + "\n" + data.payerAddress + "\n" + data.payerCityStateZip;
  safeSetTextField(form, basePrefix + ".LeftCol[0].f1_2[0]", payerInfo);

  safeSetTextField(form, basePrefix + ".LeftCol[0].f1_3[0]", formatTIN(data.payerTIN));
  safeSetTextField(form, basePrefix + ".LeftCol[0].f1_4[0]", formatTIN(data.recipientTIN));
  safeSetTextField(form, basePrefix + ".LeftCol[0].f1_5[0]", data.recipientName);
  safeSetTextField(form, basePrefix + ".LeftCol[0].f1_6[0]", data.recipientStreetAddress);
  safeSetTextField(form, basePrefix + ".LeftCol[0].f1_7[0]", data.recipientCityStateZip);

  if (data.accountNumber) {
    safeSetTextField(form, basePrefix + ".LeftCol[0].f1_8[0]", data.accountNumber);
  }

  safeSetTextField(form, basePrefix + ".RightCol[0].f1_9[0]", data.nonemployeeCompensation);

  if (data.federalIncomeTaxWithheld) {
    safeSetTextField(form, basePrefix + ".RightCol[0].f1_10[0]", data.federalIncomeTaxWithheld);
  }

  if (data.statePayerStateNo) {
    safeSetTextField(form, basePrefix + ".RightCol[0].f1_11[0]", data.statePayerStateNo);
  }

  if (data.stateIncome) {
    safeSetTextField(form, basePrefix + ".RightCol[0].f1_12[0]", data.stateIncome);
  }
}

export async function generate1099NECPDF(formData: Form1099NECData): Promise<Blob> {
  const templateUrl = "/forms/1099-nec-fillable.pdf";
  const existingPdfBytes = await fetch(templateUrl).then(function(res) {
    return res.arrayBuffer();
  });
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  const fields = form.getFields();
  console.log("Available 1099-NEC form fields:", fields.map(function(f) { return f.getName(); }));

  for (let i = 0; i < COPY_PREFIXES.length; i++) {
    fillFormCopy(form, formData, COPY_PREFIXES[i]);
  }

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helveticaFont);
  form.flatten();

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export async function download1099NECPDF(formData: Form1099NECData, fileName?: string): Promise<void> {
  const blob = await generate1099NECPDF(formData);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "1099-NEC_" + formData.year + "_" + formData.recipientName.replace(/\s+/g, "_") + ".pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
