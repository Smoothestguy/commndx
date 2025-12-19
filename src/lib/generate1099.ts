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
}

export interface Generate1099Options {
  taxYear: number;
  w9Form: W9Form;
  personnel: PersonnelInfo;
  company: CompanyInfo;
  payments: PaymentData;
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
  const { taxYear, w9Form, personnel, company, payments } = options;
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  // Set fonts
  doc.setFont("helvetica");
  
  // Page dimensions
  const pageWidth = 215.9; // Letter width in mm
  const pageHeight = 279.4; // Letter height in mm
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Colors
  const blackColor = "#000000";
  const grayColor = "#666666";
  const lightGrayColor = "#cccccc";

  let y = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(blackColor);
  doc.text(`${taxYear} Form 1099-NEC`, pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Nonemployee Compensation", pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(grayColor);
  doc.text("Copy B - For Recipient", pageWidth / 2, y, { align: "center" });
  y += 10;

  // Draw main form box
  doc.setDrawColor(blackColor);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, 180);

  // Left column (Payer info)
  const leftColX = margin + 3;
  const leftColWidth = contentWidth / 2 - 5;
  const rightColX = margin + contentWidth / 2 + 2;
  const rightColWidth = contentWidth / 2 - 5;

  let boxY = y + 3;

  // Payer's name box
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("PAYER'S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.", leftColX, boxY);
  boxY += 3;

  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.setFont("helvetica", "bold");
  doc.text(company.legal_name || company.company_name, leftColX, boxY);
  boxY += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (company.address) {
    doc.text(company.address, leftColX, boxY);
    boxY += 4;
  }
  if (company.city && company.state && company.zip) {
    doc.text(`${company.city}, ${company.state} ${company.zip}`, leftColX, boxY);
    boxY += 4;
  }
  if (company.phone) {
    doc.text(company.phone, leftColX, boxY);
    boxY += 4;
  }

  // Vertical divider
  doc.setDrawColor(lightGrayColor);
  doc.line(margin + contentWidth / 2, y, margin + contentWidth / 2, y + 180);

  // Right side boxes
  let rightY = y + 3;

  // Box 1 - Nonemployee compensation
  doc.setDrawColor(blackColor);
  doc.rect(rightColX, rightY, rightColWidth, 25);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("1 Nonemployee compensation", rightColX + 2, rightY + 4);
  doc.setFontSize(12);
  doc.setTextColor(blackColor);
  doc.setFont("helvetica", "bold");
  doc.text(`$ ${formatCurrency(payments.totalNonemployeeCompensation)}`, rightColX + rightColWidth - 5, rightY + 17, { align: "right" });
  rightY += 27;

  // Box 2 - Checkbox (Payer made direct sales)
  doc.setFont("helvetica", "normal");
  doc.rect(rightColX, rightY, rightColWidth / 2, 15);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("2", rightColX + 2, rightY + 4);
  doc.setFontSize(6);
  doc.text("Payer made direct sales totaling", rightColX + 2, rightY + 8);
  doc.text("$5,000 or more of consumer", rightColX + 2, rightY + 11);
  doc.text("products to recipient for resale", rightColX + 2, rightY + 14);

  // Box 4 - Federal income tax withheld
  doc.rect(rightColX + rightColWidth / 2, rightY, rightColWidth / 2, 15);
  doc.setFontSize(7);
  doc.text("4 Federal income tax withheld", rightColX + rightColWidth / 2 + 2, rightY + 4);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(`$ ${formatCurrency(payments.federalTaxWithheld)}`, rightColX + rightColWidth - 5, rightY + 11, { align: "right" });
  rightY += 17;

  // Payer's TIN
  boxY = y + 45;
  doc.setDrawColor(blackColor);
  doc.rect(leftColX - 3, boxY, leftColWidth + 3, 15);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("PAYER'S TIN", leftColX, boxY + 4);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(company.tax_id || "XX-XXXXXXX", leftColX, boxY + 11);

  // Recipient's TIN
  doc.rect(leftColX - 3, boxY + 17, leftColWidth + 3, 15);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("RECIPIENT'S TIN", leftColX, boxY + 21);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(maskSSN(personnel.ssn_last_four), leftColX, boxY + 28);

  // Recipient's name
  doc.rect(leftColX - 3, boxY + 34, leftColWidth + 3, 12);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("RECIPIENT'S name", leftColX, boxY + 38);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.setFont("helvetica", "bold");
  doc.text(w9Form.name_on_return, leftColX, boxY + 45);

  // Street address
  doc.setFont("helvetica", "normal");
  doc.rect(leftColX - 3, boxY + 48, leftColWidth + 3, 12);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("Street address (including apt. no.)", leftColX, boxY + 52);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(w9Form.address || personnel.address || "", leftColX, boxY + 59);

  // City, state, ZIP
  doc.rect(leftColX - 3, boxY + 62, leftColWidth + 3, 12);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("City or town, state or province, country, and ZIP or foreign postal code", leftColX, boxY + 66);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  const cityStateZip = [
    w9Form.city || personnel.city,
    w9Form.state || personnel.state,
    w9Form.zip || personnel.zip
  ].filter(Boolean).join(", ");
  doc.text(cityStateZip, leftColX, boxY + 73);

  // Right side - State tax boxes
  rightY = y + 95;
  
  // Box 5 - State tax withheld
  doc.rect(rightColX, rightY, rightColWidth / 2, 20);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("5 State tax withheld", rightColX + 2, rightY + 4);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(`$ ${formatCurrency(payments.stateTaxWithheld)}`, rightColX + rightColWidth / 2 - 5, rightY + 14, { align: "right" });

  // Box 6 - State/Payer's state no.
  doc.rect(rightColX + rightColWidth / 2, rightY, rightColWidth / 2, 20);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("6 State/Payer's state no.", rightColX + rightColWidth / 2 + 2, rightY + 4);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(company.state || "", rightColX + rightColWidth - 5, rightY + 14, { align: "right" });

  // Box 7 - State income
  rightY += 22;
  doc.rect(rightColX, rightY, rightColWidth, 20);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("7 State income", rightColX + 2, rightY + 4);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(`$ ${formatCurrency(payments.stateIncome)}`, rightColX + rightColWidth - 5, rightY + 14, { align: "right" });

  // Account number
  boxY = y + 155;
  doc.rect(leftColX - 3, boxY, contentWidth - leftColX + margin, 12);
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("Account number (see instructions)", leftColX, boxY + 4);
  doc.setFontSize(10);
  doc.setTextColor(blackColor);
  doc.text(w9Form.account_numbers || "", leftColX, boxY + 10);

  // Footer instructions
  y = y + 185;
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("This is important tax information and is being furnished to the IRS. If you are required to file a return, a", margin, y);
  y += 3;
  doc.text("negligence penalty or other sanction may be imposed on you if this income is taxable and the IRS", margin, y);
  y += 3;
  doc.text("determines that it has not been reported.", margin, y);
  y += 6;
  
  doc.setFont("helvetica", "bold");
  doc.text("Form 1099-NEC", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`(Rev. January ${taxYear})`, margin + 25, y);
  doc.text("Department of the Treasury - Internal Revenue Service", margin + 80, y);

  // Second copy indicator
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(blackColor);
  doc.text(`Tax Year: ${taxYear}`, pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(grayColor);
  doc.text("This form is for informational purposes. Please consult with a tax professional for official filings.", pageWidth / 2, y, { align: "center" });

  return doc;
}

// Download the generated PDF
export function downloadForm1099(options: Generate1099Options) {
  const doc = generate1099NEC(options);
  const fileName = `1099-NEC_${options.taxYear}_${options.personnel.last_name}_${options.personnel.first_name}.pdf`;
  doc.save(fileName);
}
