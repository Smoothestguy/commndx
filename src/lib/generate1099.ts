import { jsPDF } from "jspdf";
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
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Mask SSN for display
const maskSSN = (ssnLastFour: string | null | undefined): string => {
  if (!ssnLastFour) return "XXX-XX-XXXX";
  return `XXX-XX-${ssnLastFour}`;
};

export function generate1099NEC(options: Generate1099Options): jsPDF {
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
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  // Page dimensions
  const pageWidth = 215.9;
  const margin = 12;
  const formWidth = 190;
  const formStartX = (pageWidth - formWidth) / 2;
  
  // Layout dimensions - IRS-accurate
  const leftColWidth = 95;
  const rightColWidth = formWidth - leftColWidth;
  const rightColX = formStartX + leftColWidth;

  // Row heights
  const payerBoxHeight = 32;
  const tinBoxHeight = 10;
  const nameBoxHeight = 10;
  const addressBoxHeight = 10;
  const cityBoxHeight = 10;
  const accountBoxHeight = 10;
  
  // Right side box heights
  const box1Height = 20;
  const box2Height = 10;
  const box3Height = 10;
  const box4Height = 10;
  const stateBoxHeight = 12;

  let y = margin;

  // ============== HEADER SECTION ==============
  
  // VOID / CORRECTED checkboxes (top right)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  
  // VOID checkbox
  doc.rect(formStartX + formWidth - 45, y, 3, 3);
  if (isVoid) {
    doc.setFont("helvetica", "bold");
    doc.text("✓", formStartX + formWidth - 44.5, y + 2.5);
    doc.setFont("helvetica", "normal");
  }
  doc.text("VOID", formStartX + formWidth - 40, y + 2.5);
  
  // CORRECTED checkbox
  doc.rect(formStartX + formWidth - 25, y, 3, 3);
  if (isCorrected) {
    doc.setFont("helvetica", "bold");
    doc.text("✓", formStartX + formWidth - 24.5, y + 2.5);
    doc.setFont("helvetica", "normal");
  }
  doc.text("CORRECTED", formStartX + formWidth - 20, y + 2.5);

  y += 8;

  // Form title and OMB
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Form 1099-NEC", formStartX, y);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("OMB No. 1545-0116", formStartX + formWidth - 30, y - 2);
  
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Nonemployee", formStartX + formWidth - 28, y);
  y += 4;
  doc.text("Compensation", formStartX + formWidth - 28, y);
  
  // Revision date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("(Rev. April 2025)", formStartX, y - 4);
  
  // Calendar year
  y += 4;
  doc.setFontSize(7);
  doc.text("For calendar year", formStartX, y);
  
  // Year box
  doc.rect(formStartX + 22, y - 3, 12, 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(taxYear.toString(), formStartX + 24, y + 0.5);
  
  y += 8;

  // ============== MAIN FORM GRID ==============
  const formTopY = y;
  
  // Draw outer border
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  
  // ============== LEFT COLUMN ==============
  
  // PAYER'S info box (top left, tall box)
  doc.rect(formStartX, formTopY, leftColWidth, payerBoxHeight);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("PAYER'S name, street address, city or town, state or province, country, ZIP", formStartX + 1, formTopY + 3);
  doc.text("or foreign postal code, and telephone no.", formStartX + 1, formTopY + 6);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(company.legal_name || company.company_name, formStartX + 1, formTopY + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let payerY = formTopY + 15;
  if (company.address) {
    doc.text(company.address, formStartX + 1, payerY);
    payerY += 4;
  }
  if (company.city && company.state && company.zip) {
    doc.text(`${company.city}, ${company.state} ${company.zip}`, formStartX + 1, payerY);
    payerY += 4;
  }
  if (company.phone) {
    doc.text(company.phone, formStartX + 1, payerY);
  }

  let leftY = formTopY + payerBoxHeight;

  // PAYER'S TIN | RECIPIENT'S TIN row
  doc.rect(formStartX, leftY, leftColWidth / 2, tinBoxHeight);
  doc.rect(formStartX + leftColWidth / 2, leftY, leftColWidth / 2, tinBoxHeight);
  
  doc.setFontSize(6);
  doc.text("PAYER'S TIN", formStartX + 1, leftY + 3);
  doc.text("RECIPIENT'S TIN", formStartX + leftColWidth / 2 + 1, leftY + 3);
  
  doc.setFontSize(9);
  doc.text(company.tax_id || "XX-XXXXXXX", formStartX + 1, leftY + 8);
  doc.text(maskSSN(personnel.ssn_last_four), formStartX + leftColWidth / 2 + 1, leftY + 8);
  
  leftY += tinBoxHeight;

  // RECIPIENT'S name
  doc.rect(formStartX, leftY, leftColWidth, nameBoxHeight);
  doc.setFontSize(6);
  doc.text("RECIPIENT'S name", formStartX + 1, leftY + 3);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(w9Form.name_on_return, formStartX + 1, leftY + 8);
  doc.setFont("helvetica", "normal");
  
  leftY += nameBoxHeight;

  // Street address
  doc.rect(formStartX, leftY, leftColWidth, addressBoxHeight);
  doc.setFontSize(6);
  doc.text("Street address (including apt. no.)", formStartX + 1, leftY + 3);
  doc.setFontSize(9);
  doc.text(w9Form.address || personnel.address || "", formStartX + 1, leftY + 8);
  
  leftY += addressBoxHeight;

  // City, state, ZIP
  doc.rect(formStartX, leftY, leftColWidth, cityBoxHeight);
  doc.setFontSize(6);
  doc.text("City or town, state or province, country, and ZIP or foreign postal code", formStartX + 1, leftY + 3);
  doc.setFontSize(9);
  const cityStateZip = [
    w9Form.city || personnel.city,
    w9Form.state || personnel.state,
    w9Form.zip || personnel.zip
  ].filter(Boolean).join(", ");
  doc.text(cityStateZip, formStartX + 1, leftY + 8);
  
  leftY += cityBoxHeight;

  // Account number (see instructions)
  doc.rect(formStartX, leftY, leftColWidth, accountBoxHeight);
  doc.setFontSize(6);
  doc.text("Account number (see instructions)", formStartX + 1, leftY + 3);
  doc.setFontSize(9);
  doc.text(w9Form.account_numbers || "", formStartX + 1, leftY + 8);

  // ============== RIGHT COLUMN ==============
  let rightY = formTopY;
  const rightBoxWidth = rightColWidth;
  const halfRightWidth = rightColWidth / 2;

  // Box 1 - Nonemployee compensation (large box at top right)
  doc.rect(rightColX, rightY, rightBoxWidth, box1Height);
  doc.setFontSize(6);
  doc.text("1  Nonemployee compensation", rightColX + 1, rightY + 3);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("$", rightColX + 1, rightY + 14);
  doc.text(formatCurrency(payments.totalNonemployeeCompensation), rightColX + rightBoxWidth - 2, rightY + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  
  rightY += box1Height;

  // Row with Box 2 checkbox and 2nd TIN not.
  const box2Width = rightBoxWidth * 0.65;
  const tinNotWidth = rightBoxWidth - box2Width;
  
  // Box 2 - Payer made direct sales
  doc.rect(rightColX, rightY, box2Width, box2Height);
  doc.setFontSize(6);
  
  // Checkbox for Box 2
  doc.rect(rightColX + 2, rightY + 3.5, 2.5, 2.5);
  if (directSales5000Plus) {
    doc.setFont("helvetica", "bold");
    doc.text("✓", rightColX + 2.3, rightY + 5.5);
    doc.setFont("helvetica", "normal");
  }
  
  doc.text("2  Payer made direct sales totaling $5,000 or", rightColX + 6, rightY + 4);
  doc.text("more of consumer products to recipient for resale", rightColX + 6, rightY + 7);
  
  // 2nd TIN not.
  doc.rect(rightColX + box2Width, rightY, tinNotWidth, box2Height);
  doc.setFontSize(6);
  doc.text("2nd TIN not.", rightColX + box2Width + 1, rightY + 4);
  if (secondTinNotification) {
    doc.rect(rightColX + box2Width + 3, rightY + 5, 2.5, 2.5);
    doc.setFont("helvetica", "bold");
    doc.text("✓", rightColX + box2Width + 3.3, rightY + 7);
    doc.setFont("helvetica", "normal");
  }
  
  rightY += box2Height;

  // Box 3 - Excess golden parachute payments
  doc.rect(rightColX, rightY, rightBoxWidth, box3Height);
  doc.setFontSize(6);
  doc.text("3  Excess golden parachute payments", rightColX + 1, rightY + 3);
  doc.setFontSize(9);
  doc.text("$", rightColX + 1, rightY + 8);
  const goldenParachute = payments.excessGoldenParachute || 0;
  if (goldenParachute > 0) {
    doc.text(formatCurrency(goldenParachute), rightColX + rightBoxWidth - 2, rightY + 8, { align: "right" });
  }
  
  rightY += box3Height;

  // Box 4 - Federal income tax withheld
  doc.rect(rightColX, rightY, rightBoxWidth, box4Height);
  doc.setFontSize(6);
  doc.text("4  Federal income tax withheld", rightColX + 1, rightY + 3);
  doc.setFontSize(9);
  doc.text("$", rightColX + 1, rightY + 8);
  doc.text(formatCurrency(payments.federalTaxWithheld), rightColX + rightBoxWidth - 2, rightY + 8, { align: "right" });
  
  rightY += box4Height;

  // State tax row (Boxes 5, 6, 7)
  const stateBoxWidth = rightBoxWidth / 3;
  
  // Box 5 - State tax withheld
  doc.rect(rightColX, rightY, stateBoxWidth, stateBoxHeight);
  doc.setFontSize(6);
  doc.text("5  State tax withheld", rightColX + 1, rightY + 3);
  doc.setFontSize(8);
  doc.text("$", rightColX + 1, rightY + 9);
  doc.text(formatCurrency(payments.stateTaxWithheld), rightColX + stateBoxWidth - 2, rightY + 9, { align: "right" });
  
  // Box 6 - State/Payer's state no.
  doc.rect(rightColX + stateBoxWidth, rightY, stateBoxWidth, stateBoxHeight);
  doc.setFontSize(6);
  doc.text("6  State/Payer's state no.", rightColX + stateBoxWidth + 1, rightY + 3);
  doc.setFontSize(8);
  doc.text(company.state || "", rightColX + stateBoxWidth + 1, rightY + 9);
  
  // Box 7 - State income
  doc.rect(rightColX + stateBoxWidth * 2, rightY, stateBoxWidth, stateBoxHeight);
  doc.setFontSize(6);
  doc.text("7  State income", rightColX + stateBoxWidth * 2 + 1, rightY + 3);
  doc.setFontSize(8);
  doc.text("$", rightColX + stateBoxWidth * 2 + 1, rightY + 9);
  doc.text(formatCurrency(payments.stateIncome), rightColX + rightBoxWidth - 2, rightY + 9, { align: "right" });

  // ============== FOOTER ==============
  const footerY = leftY + accountBoxHeight + 5;
  
  // Form identification
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Form 1099-NEC", formStartX, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("(Rev. 4-2025)", formStartX + 25, footerY);
  
  // Cat. No.
  doc.text("Cat. No. 72590N", formStartX + 50, footerY);
  
  // IRS website
  doc.text("www.irs.gov/Form1099NEC", formStartX + 80, footerY);
  
  // Department info
  doc.text("Department of the Treasury - Internal Revenue Service", formStartX + 125, footerY);

  // ============== COPY B DESIGNATION ==============
  y = footerY + 10;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Copy B", formStartX + formWidth / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("For Recipient", formStartX + formWidth / 2, y, { align: "center" });
  
  y += 8;
  
  // Important tax information notice
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const notice1 = "This is important tax information and is being furnished to the IRS. If you are required to file a return,";
  const notice2 = "a negligence penalty or other sanction may be imposed on you if this income is taxable and the IRS";
  const notice3 = "determines that it has not been reported.";
  
  doc.text(notice1, formStartX, y);
  y += 3;
  doc.text(notice2, formStartX, y);
  y += 3;
  doc.text(notice3, formStartX, y);
  
  y += 8;
  
  // Instructions reference
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.text("For more information about Form 1099-NEC, see www.irs.gov/Form1099NEC", formStartX, y);

  return doc;
}

// Download the generated PDF
export function downloadForm1099(options: Generate1099Options) {
  const doc = generate1099NEC(options);
  const fileName = `1099-NEC_${options.taxYear}_${options.personnel.last_name}_${options.personnel.first_name}.pdf`;
  doc.save(fileName);
}
