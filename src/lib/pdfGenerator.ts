// PDF Generator for W-9 forms - v2
import { PDFDocument, StandardFonts } from "pdf-lib";

export interface W9PDFFormData {
  name: string;
  businessName?: string;
  taxClassification: string;
  llcTaxCode?: string;
  otherTaxClassification?: string;
  exemptPayeeCode?: string;
  fatcaExemptionCode?: string;
  address: string;
  cityStateZip: string;
  accountNumbers?: string;
  tinType: "ssn" | "ein";
  tin: string;
  signatureData?: string;
  signatureDate?: string;
}

function safeSetTextField(
  form: ReturnType<typeof PDFDocument.prototype.getForm>,
  fieldName: string,
  value: string
): void {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch (error) {
    console.warn("Could not fill field " + fieldName + ":", error);
  }
}

export async function generateW9PDF(formData: W9PDFFormData): Promise<Blob> {
  const templateUrl = "/forms/w9-fillable.pdf";
  const existingPdfBytes = await fetch(templateUrl).then(function(res) {
    return res.arrayBuffer();
  });
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // Line 1: Name
  safeSetTextField(form, "topmostSubform[0].Page1[0].f1_01[0]", formData.name);

  // Line 2: Business name
  if (formData.businessName) {
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_02[0]", formData.businessName);
  }

  // Tax Classification checkboxes
  const taxClassificationMap: Record<string, number> = {
    individual: 0,
    c_corp: 1,
    s_corp: 2,
    partnership: 3,
    trust_estate: 4,
    llc: 5,
    other: 6
  };

  const normalizedClassification = formData.taxClassification.toLowerCase().replace(/[\s-]/g, "_");
  const checkboxIndex = taxClassificationMap[normalizedClassification];

  if (checkboxIndex !== undefined) {
    try {
      const checkboxName = "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[" + checkboxIndex + "]";
      form.getCheckBox(checkboxName).check();
    } catch (error) {
      console.warn("Could not check tax classification:", error);
    }
  }

  // LLC tax code
  if (formData.llcTaxCode) {
    safeSetTextField(form, "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]", formData.llcTaxCode);
  }

  // Other classification
  if (formData.otherTaxClassification) {
    safeSetTextField(form, "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]", formData.otherTaxClassification);
  }

  // Exempt payee code
  if (formData.exemptPayeeCode) {
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_05[0]", formData.exemptPayeeCode);
  }

  // FATCA exemption code
  if (formData.fatcaExemptionCode) {
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_06[0]", formData.fatcaExemptionCode);
  }

  // Address fields
  safeSetTextField(form, "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]", formData.address);
  safeSetTextField(form, "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]", formData.cityStateZip);

  // Account numbers
  if (formData.accountNumbers) {
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_09[0]", formData.accountNumbers);
  }

  // TIN (SSN or EIN) - fill each field separately
  const tinClean = formData.tin.replace(/\D/g, "");
  if (formData.tinType === "ssn" && tinClean.length === 9) {
    // SSN fields: f1_11 (3 digits), f1_12 (2 digits), f1_13 (4 digits)
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_11[0]", tinClean.substring(0, 3));
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_12[0]", tinClean.substring(3, 5));
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_13[0]", tinClean.substring(5, 9));
  } else if (formData.tinType === "ein" && tinClean.length >= 9) {
    // EIN fields: f1_14 (2 digits), f1_15 (7 digits)
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_14[0]", tinClean.substring(0, 2));
    safeSetTextField(form, "topmostSubform[0].Page1[0].f1_15[0]", tinClean.substring(2, 9));
  }

  // Embed signature if provided
  if (formData.signatureData && formData.signatureData.startsWith("data:image")) {
    try {
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const base64Data = formData.signatureData.split(",")[1];
      const imageBytes = Uint8Array.from(atob(base64Data), function(c) {
        return c.charCodeAt(0);
      });
      const signatureImage = await pdfDoc.embedPng(imageBytes);
      const signatureDims = signatureImage.scale(0.3);
      firstPage.drawImage(signatureImage, {
        x: 75,
        y: 195,
        width: Math.min(signatureDims.width, 150),
        height: Math.min(signatureDims.height, 40)
      });
    } catch (error) {
      console.warn("Could not embed signature:", error);
    }
  }

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helveticaFont);
  form.flatten();

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export async function downloadW9PDF(formData: W9PDFFormData, fileName?: string): Promise<void> {
  const blob = await generateW9PDF(formData);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "W-9_" + formData.name.replace(/\s+/g, "_") + ".pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
