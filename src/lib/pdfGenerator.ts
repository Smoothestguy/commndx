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

export async function generateW9PDF(formData: W9PDFFormData): Promise<Blob> {
  // Load official fillable W-9 PDF template
  const templateUrl = "/forms/w9-fillable.pdf";
  const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // Fill form fields based on official W-9 field names
  // Line 1: Name
  try {
    form.getTextField("topmostSubform[0].Page1[0].f1_01[0]").setText(formData.name);
  } catch (e) {
    console.warn("Could not fill name field:", e);
  }

  // Line 2: Business name
  if (formData.businessName) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_02[0]").setText(formData.businessName);
    } catch (e) {
      console.warn("Could not fill business name field:", e);
    }
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
  
  const normalizedClassification = formData.taxClassification.toLowerCase().replace(/[\s-]/g, '_');
  const checkboxIndex = taxClassificationMap[normalizedClassification];
  
  if (checkboxIndex !== undefined) {
    try {
      form.getCheckBox(`topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[${checkboxIndex}]`).check();
    } catch (e) {
      console.warn("Could not check tax classification:", e);
    }
  }

  // LLC tax code
  if (formData.llcTaxCode) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]").setText(formData.llcTaxCode);
    } catch (e) {
      console.warn("Could not fill LLC tax code:", e);
    }
  }

  // Other classification
  if (formData.otherTaxClassification) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]").setText(formData.otherTaxClassification);
    } catch (e) {
      console.warn("Could not fill other classification:", e);
    }
  }

  // Exempt payee code
  if (formData.exemptPayeeCode) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_05[0]").setText(formData.exemptPayeeCode);
    } catch (e) {
      console.warn("Could not fill exempt payee code:", e);
    }
  }

  // FATCA exemption code
  if (formData.fatcaExemptionCode) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_06[0]").setText(formData.fatcaExemptionCode);
    } catch (e) {
      console.warn("Could not fill FATCA exemption code:", e);
    }
  }

  // Address fields
  try {
    form.getTextField("topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]").setText(formData.address);
  } catch (e) {
    console.warn("Could not fill address:", e);
  }
  
  try {
    form.getTextField("topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]").setText(formData.cityStateZip);
  } catch (e) {
    console.warn("Could not fill city/state/zip:", e);
  }

  // Account numbers
  if (formData.accountNumbers) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_09[0]").setText(formData.accountNumbers);
    } catch (e) {
      console.warn("Could not fill account numbers:", e);
    }
  }

  // TIN (SSN or EIN)
  const tinClean = formData.tin.replace(/\D/g, "");
  if (formData.tinType === "ssn" && tinClean.length === 9) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_10[0]").setText(tinClean.substring(0, 3));
      form.getTextField("topmostSubform[0].Page1[0].f1_11[0]").setText(tinClean.substring(3, 5));
      form.getTextField("topmostSubform[0].Page1[0].f1_12[0]").setText(tinClean.substring(5, 9));
    } catch (e) {
      console.warn("Could not fill SSN:", e);
    }
  } else if (formData.tinType === "ein" && tinClean.length >= 9) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_13[0]").setText(tinClean.substring(0, 2));
      form.getTextField("topmostSubform[0].Page1[0].f1_14[0]").setText(tinClean.substring(2, 9));
    } catch (e) {
      console.warn("Could not fill EIN:", e);
    }
  }

  // Embed signature if provided
  if (formData.signatureData && formData.signatureData.startsWith('data:image')) {
    try {
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      
      // Extract base64 data
      const base64Data = formData.signatureData.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Embed the image
      const signatureImage = await pdfDoc.embedPng(imageBytes);
      
      // Draw signature on the form (approximate signature line position)
      const signatureDims = signatureImage.scale(0.3);
      firstPage.drawImage(signatureImage, {
        x: 50,
        y: 100,
        width: Math.min(signatureDims.width, 150),
        height: Math.min(signatureDims.height, 40),
      });
    } catch (e) {
      console.warn("Could not embed signature:", e);
    }
  }

  // Add signature date if provided
  if (formData.signatureDate) {
    try {
      form.getTextField("topmostSubform[0].Page1[0].f1_15[0]").setText(formData.signatureDate);
    } catch (e) {
      console.warn("Could not fill signature date:", e);
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
  link.download = fileName || `W-9_${formData.name.replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
