import { jsPDF } from "jspdf";
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";

export interface GenerateW9Options {
  w9Form: W9Form;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

// Mask SSN for display
const maskSSN = (ssnLastFour: string | null | undefined, ssnFull?: string | null): string => {
  if (ssnFull) {
    // Format full SSN: XXX-XX-XXXX
    const cleaned = ssnFull.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
    return ssnFull;
  }
  if (!ssnLastFour) return "";
  return `***-**-${ssnLastFour}`;
};

// Format EIN: XX-XXXXXXX
const formatEIN = (ein: string | null): string => {
  if (!ein) return "";
  const cleaned = ein.replace(/\D/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  }
  return ein;
};

// Get tax classification display text
const getTaxClassificationText = (classification: string): string => {
  const classifications: Record<string, string> = {
    'individual': 'Individual/sole proprietor or single-member LLC',
    'c_corporation': 'C Corporation',
    's_corporation': 'S Corporation',
    'partnership': 'Partnership',
    'trust_estate': 'Trust/estate',
    'llc': 'Limited liability company',
    'other': 'Other',
  };
  return classifications[classification] || classification;
};

export function generateW9(options: GenerateW9Options): jsPDF {
  const { w9Form, ssnLastFour, ssnFull } = options;
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  // Page dimensions
  const pageWidth = 215.9;
  const margin = 10;
  const formWidth = pageWidth - margin * 2;
  const formStartX = margin;

  let y = margin;

  // ============== HEADER SECTION ==============
  
  // Form title line
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Form", formStartX, y + 5);
  
  doc.setFontSize(24);
  doc.text("W-9", formStartX + 12, y + 5);
  
  // Revision info
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("(Rev. March 2024)", formStartX, y + 10);

  // Department info
  doc.setFontSize(7);
  doc.text("Department of the Treasury", formStartX, y + 14);
  doc.text("Internal Revenue Service", formStartX, y + 17);

  // Main title (center-right)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Request for Taxpayer", formStartX + 50, y + 3);
  doc.text("Identification Number and Certification", formStartX + 50, y + 7);

  // Right side instructions
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const rightX = formStartX + formWidth - 60;
  doc.text("Go to www.irs.gov/FormW9 for", rightX, y + 3);
  doc.text("instructions and the latest information.", rightX, y + 6);

  // OMB Number
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("OMB No. 1545-0074", formStartX + formWidth - 30, y + 12);

  y += 22;

  // Horizontal line under header
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(formStartX, y, formStartX + formWidth, y);

  y += 2;

  // ============== LINE 1: NAME ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("1", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("Name (as shown on your income tax return). Name is required on this line; do not leave this line blank.", formStartX + 5, y + 3);
  
  y += 5;
  
  // Name box
  doc.setLineWidth(0.3);
  doc.rect(formStartX, y, formWidth, 8);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(w9Form.name_on_return, formStartX + 2, y + 5.5);
  
  y += 10;

  // ============== LINE 2: BUSINESS NAME ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("2", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("Business name/disregarded entity name, if different from above", formStartX + 5, y + 3);
  
  y += 5;
  
  // Business name box
  doc.rect(formStartX, y, formWidth, 8);
  if (w9Form.business_name) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(w9Form.business_name, formStartX + 2, y + 5.5);
  }
  
  y += 10;

  // ============== LINE 3: FEDERAL TAX CLASSIFICATION ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("3", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("Check appropriate box for federal tax classification of the person whose name is entered on line 1. Check only one of the", formStartX + 5, y + 3);
  doc.text("following seven boxes.", formStartX + 5, y + 6);
  
  y += 9;

  // Tax classification checkboxes
  const checkboxSize = 3;
  const classifications = [
    { key: 'individual', label: 'Individual/sole proprietor or single-member LLC' },
    { key: 'c_corporation', label: 'C Corporation' },
    { key: 's_corporation', label: 'S Corporation' },
    { key: 'partnership', label: 'Partnership' },
    { key: 'trust_estate', label: 'Trust/estate' },
  ];
  
  let checkX = formStartX + 2;
  doc.setFontSize(6.5);
  
  classifications.forEach((item) => {
    doc.rect(checkX, y, checkboxSize, checkboxSize);
    if (w9Form.federal_tax_classification === item.key) {
      doc.setFont("helvetica", "bold");
      doc.text("X", checkX + 0.7, y + 2.5);
      doc.setFont("helvetica", "normal");
    }
    doc.text(item.label, checkX + checkboxSize + 1, y + 2.5);
    checkX += doc.getTextWidth(item.label) + checkboxSize + 6;
    
    // Wrap to next line if needed
    if (checkX > formStartX + formWidth - 40) {
      checkX = formStartX + 2;
      y += 5;
    }
  });

  y += 5;
  
  // LLC checkbox with tax classification
  doc.rect(formStartX + 2, y, checkboxSize, checkboxSize);
  if (w9Form.federal_tax_classification === 'llc') {
    doc.setFont("helvetica", "bold");
    doc.text("X", formStartX + 2.7, y + 2.5);
    doc.setFont("helvetica", "normal");
  }
  doc.text("Limited liability company. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership)", formStartX + 6, y + 2.5);
  
  // LLC tax classification box
  doc.rect(formStartX + 135, y - 0.5, 8, 4);
  if (w9Form.llc_tax_classification) {
    doc.setFontSize(8);
    doc.text(w9Form.llc_tax_classification.toUpperCase().charAt(0), formStartX + 138, y + 2);
    doc.setFontSize(6.5);
  }
  
  y += 5;
  
  // Other checkbox
  doc.rect(formStartX + 2, y, checkboxSize, checkboxSize);
  if (w9Form.federal_tax_classification === 'other') {
    doc.setFont("helvetica", "bold");
    doc.text("X", formStartX + 2.7, y + 2.5);
    doc.setFont("helvetica", "normal");
  }
  doc.text("Other (see instructions)", formStartX + 6, y + 2.5);
  
  // Other classification line
  doc.line(formStartX + 40, y + 3, formStartX + 100, y + 3);
  if (w9Form.other_classification) {
    doc.setFontSize(8);
    doc.text(w9Form.other_classification, formStartX + 42, y + 2);
    doc.setFontSize(6.5);
  }
  
  y += 8;

  // ============== LINE 4: EXEMPTIONS ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("4", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):", formStartX + 5, y + 3);
  
  y += 6;
  
  // Exemption code boxes
  doc.text("Exempt payee code (if any)", formStartX + 5, y + 3);
  doc.rect(formStartX + 50, y, 20, 5);
  if (w9Form.exempt_payee_code) {
    doc.setFontSize(8);
    doc.text(w9Form.exempt_payee_code, formStartX + 52, y + 3.5);
    doc.setFontSize(7);
  }
  
  doc.text("Exemption from FATCA reporting code (if any)", formStartX + 80, y + 3);
  doc.rect(formStartX + 145, y, 20, 5);
  if (w9Form.fatca_exemption_code) {
    doc.setFontSize(8);
    doc.text(w9Form.fatca_exemption_code, formStartX + 147, y + 3.5);
    doc.setFontSize(7);
  }
  
  y += 8;

  // ============== LINE 5: ADDRESS ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("5", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("Address (number, street, and apt. or suite no.) See instructions.", formStartX + 5, y + 3);
  
  y += 5;
  
  // Address box
  doc.rect(formStartX, y, formWidth * 0.65, 8);
  doc.setFontSize(10);
  doc.text(w9Form.address, formStartX + 2, y + 5.5);
  
  // Requester's name box (right side)
  doc.setFontSize(6);
  doc.text("Requester's name and address (optional)", formStartX + formWidth * 0.67, y - 2);
  doc.rect(formStartX + formWidth * 0.65, y, formWidth * 0.35, 8);
  
  y += 10;

  // ============== LINE 6: CITY, STATE, ZIP ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("6", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("City, state, and ZIP code", formStartX + 5, y + 3);
  
  y += 5;
  
  // City/State/ZIP box
  doc.rect(formStartX, y, formWidth * 0.65, 8);
  doc.setFontSize(10);
  doc.text(`${w9Form.city}, ${w9Form.state} ${w9Form.zip}`, formStartX + 2, y + 5.5);
  
  // Continue requester box
  doc.rect(formStartX + formWidth * 0.65, y, formWidth * 0.35, 8);
  
  y += 10;

  // ============== LINE 7: ACCOUNT NUMBERS ==============
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("7", formStartX + 1, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("List account number(s) here (optional)", formStartX + 5, y + 3);
  
  y += 5;
  
  // Account numbers box
  doc.rect(formStartX, y, formWidth, 8);
  if (w9Form.account_numbers) {
    doc.setFontSize(10);
    doc.text(w9Form.account_numbers, formStartX + 2, y + 5.5);
  }
  
  y += 12;

  // ============== PART I: TAXPAYER IDENTIFICATION NUMBER (TIN) ==============
  doc.setFillColor(220, 220, 220);
  doc.rect(formStartX, y, formWidth, 7, 'F');
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Part I", formStartX + 2, y + 5);
  doc.text("Taxpayer Identification Number (TIN)", formStartX + 20, y + 5);
  
  y += 9;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid", formStartX + 2, y + 3);
  doc.text("backup withholding. For individuals, this is generally your social security number (SSN). However, for a", formStartX + 2, y + 6);
  doc.text("resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other", formStartX + 2, y + 9);
  doc.text("entities, it is your employer identification number (EIN). If you do not have a number, see How to get a", formStartX + 2, y + 12);
  doc.text("TIN, later.", formStartX + 2, y + 15);
  
  // TIN boxes on right side
  const tinBoxX = formStartX + formWidth - 60;
  
  // SSN label and boxes
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Social security number", tinBoxX, y + 3);
  doc.setFont("helvetica", "normal");
  
  // SSN digit boxes (3-2-4 format)
  const ssnBoxY = y + 5;
  const digitWidth = 5;
  const ssnValue = ssnFull ? ssnFull.replace(/\D/g, '') : '';
  
  // First 3 digits
  for (let i = 0; i < 3; i++) {
    doc.rect(tinBoxX + i * digitWidth, ssnBoxY, digitWidth, 6);
    if (w9Form.tin_type === 'ssn' && ssnValue[i]) {
      doc.setFontSize(10);
      doc.text(ssnValue[i], tinBoxX + i * digitWidth + 1.5, ssnBoxY + 4.5);
      doc.setFontSize(7);
    }
  }
  doc.text("-", tinBoxX + 3 * digitWidth + 0.5, ssnBoxY + 4);
  
  // Next 2 digits
  for (let i = 0; i < 2; i++) {
    doc.rect(tinBoxX + 17 + i * digitWidth, ssnBoxY, digitWidth, 6);
    if (w9Form.tin_type === 'ssn' && ssnValue[3 + i]) {
      doc.setFontSize(10);
      doc.text(ssnValue[3 + i], tinBoxX + 17 + i * digitWidth + 1.5, ssnBoxY + 4.5);
      doc.setFontSize(7);
    }
  }
  doc.text("-", tinBoxX + 17 + 2 * digitWidth + 0.5, ssnBoxY + 4);
  
  // Last 4 digits
  for (let i = 0; i < 4; i++) {
    doc.rect(tinBoxX + 30 + i * digitWidth, ssnBoxY, digitWidth, 6);
    if (w9Form.tin_type === 'ssn' && ssnValue[5 + i]) {
      doc.setFontSize(10);
      doc.text(ssnValue[5 + i], tinBoxX + 30 + i * digitWidth + 1.5, ssnBoxY + 4.5);
      doc.setFontSize(7);
    } else if (w9Form.tin_type === 'ssn' && ssnLastFour && i < 4) {
      // Show last 4 if we only have that
      doc.setFontSize(10);
      doc.text(ssnLastFour[i] || '', tinBoxX + 30 + i * digitWidth + 1.5, ssnBoxY + 4.5);
      doc.setFontSize(7);
    }
  }
  
  // "or" divider
  doc.setFontSize(8);
  doc.text("or", tinBoxX + 25, ssnBoxY + 14);
  
  // EIN label and boxes
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Employer identification number", tinBoxX, ssnBoxY + 18);
  doc.setFont("helvetica", "normal");
  
  const einBoxY = ssnBoxY + 20;
  const einValue = w9Form.ein ? w9Form.ein.replace(/\D/g, '') : '';
  
  // First 2 digits
  for (let i = 0; i < 2; i++) {
    doc.rect(tinBoxX + i * digitWidth, einBoxY, digitWidth, 6);
    if (w9Form.tin_type === 'ein' && einValue[i]) {
      doc.setFontSize(10);
      doc.text(einValue[i], tinBoxX + i * digitWidth + 1.5, einBoxY + 4.5);
      doc.setFontSize(7);
    }
  }
  doc.text("-", tinBoxX + 2 * digitWidth + 0.5, einBoxY + 4);
  
  // Last 7 digits
  for (let i = 0; i < 7; i++) {
    doc.rect(tinBoxX + 13 + i * digitWidth, einBoxY, digitWidth, 6);
    if (w9Form.tin_type === 'ein' && einValue[2 + i]) {
      doc.setFontSize(10);
      doc.text(einValue[2 + i], tinBoxX + 13 + i * digitWidth + 1.5, einBoxY + 4.5);
      doc.setFontSize(7);
    }
  }
  
  y += 45;

  // ============== PART II: CERTIFICATION ==============
  doc.setFillColor(220, 220, 220);
  doc.rect(formStartX, y, formWidth, 7, 'F');
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Part II", formStartX + 2, y + 5);
  doc.text("Certification", formStartX + 20, y + 5);
  
  y += 9;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Under penalties of perjury, I certify that:", formStartX + 2, y + 3);
  
  y += 5;
  
  // Certification items
  const certItems = [
    "1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and",
    "2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue",
    "   Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am",
    "   no longer subject to backup withholding; and",
    "3. I am a U.S. citizen or other U.S. person (defined below); and",
    "4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.",
  ];
  
  doc.setFontSize(6.5);
  certItems.forEach((item) => {
    doc.text(item, formStartX + 2, y + 3);
    y += 3;
  });
  
  y += 3;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Certification instructions.", formStartX + 2, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup", formStartX + 35, y + 3);
  doc.text("withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply.", formStartX + 2, y + 6);
  doc.text("For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement", formStartX + 2, y + 9);
  doc.text("(IRA), and generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN.", formStartX + 2, y + 12);
  
  y += 18;

  // ============== SIGNATURE SECTION ==============
  doc.setLineWidth(0.3);
  doc.line(formStartX, y, formStartX + formWidth, y);
  
  y += 3;
  
  // Sign Here label
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Sign", formStartX + 2, y + 4);
  doc.text("Here", formStartX + 2, y + 8);
  
  // Signature line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Signature of", formStartX + 15, y + 3);
  doc.text("U.S. person", formStartX + 15, y + 6);
  doc.line(formStartX + 30, y + 10, formStartX + 120, y + 10);
  
  // Electronic signature
  if (w9Form.signature_data) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text(w9Form.signature_data, formStartX + 35, y + 8);
  }
  
  // Date
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Date", formStartX + 125, y + 6);
  doc.line(formStartX + 133, y + 10, formStartX + formWidth - 5, y + 10);
  
  // Format and display signature date
  if (w9Form.signature_date) {
    const sigDate = new Date(w9Form.signature_date);
    const formattedDate = `${sigDate.getMonth() + 1}/${sigDate.getDate()}/${sigDate.getFullYear()}`;
    doc.setFontSize(10);
    doc.text(formattedDate, formStartX + 145, y + 8);
  }
  
  y += 15;

  // ============== FOOTER ==============
  doc.setLineWidth(0.5);
  doc.line(formStartX, y, formStartX + formWidth, y);
  
  y += 4;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("General Instructions", formStartX + 2, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Section references are to the Internal Revenue Code unless otherwise noted.", formStartX + 2, y + 6);
  doc.text("Future developments. For the latest information about developments related to Form W-9 and its instructions, such as legislation enacted", formStartX + 2, y + 9);
  doc.text("after they were published, go to www.irs.gov/FormW9.", formStartX + 2, y + 12);
  
  // Form identification at bottom
  y = 270;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Cat. No. 10231X", formStartX, y);
  doc.setFont("helvetica", "bold");
  doc.text("Form W-9 (Rev. 3-2024)", formStartX + formWidth - 35, y);

  return doc;
}

// Download the generated PDF
export function downloadFormW9(options: GenerateW9Options) {
  const doc = generateW9(options);
  const fileName = `W-9_${options.w9Form.name_on_return.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

// Get blob for preview/upload
export function getW9Blob(options: GenerateW9Options): Blob {
  const doc = generateW9(options);
  return doc.output('blob');
}
