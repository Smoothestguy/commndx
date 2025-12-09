import jsPDF from "jspdf";

interface LineItem {
  id: string;
  description: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  markup: number;
  total: number;
  isTaxable?: boolean;
}

interface CompanySettings {
  company_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  estimate_footer?: string | null;
}

interface EstimateData {
  number: string;
  customerName: string;
  customerAddress?: string | null;
  projectName?: string | null;
  status: string;
  createdAt: string;
  validUntil: string;
  notes?: string | null;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  salesRepName?: string | null;
  companySettings?: CompanySettings | null;
}

export const generateEstimatePDF = (estimate: EstimateData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Company settings with fallback
  const company = estimate.companySettings || {
    company_name: "Command X",
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    email: null,
    website: null,
    logo_url: null,
  };

  // Build company address string
  const companyAddressParts: string[] = [];
  if (company.address) companyAddressParts.push(company.address);
  if (company.city || company.state || company.zip) {
    const cityStateZip = [
      company.city,
      company.state,
      company.zip,
    ].filter(Boolean).join(", ");
    if (cityStateZip) companyAddressParts.push(cityStateZip);
  }

  // ==================== HEADER SECTION ====================
  // Primary color header band
  doc.setFillColor(102, 126, 234); // primary color
  doc.rect(0, 0, pageWidth, 40, "F");

  // Company name (white, bold, left)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(company.company_name || "Command X", margin, 25);

  // "ESTIMATE" title (white, right)
  doc.setFontSize(16);
  doc.text("ESTIMATE", pageWidth - margin, 25, { align: "right" });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // ==================== BILL TO & DETAILS SECTION ====================
  let yPos = 55;

  // Bill To Section (left side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("BILL TO:", margin, yPos);

  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(estimate.customerName, margin, yPos);

  if (estimate.customerAddress) {
    yPos += 6;
    const addressLines = doc.splitTextToSize(estimate.customerAddress, 80);
    addressLines.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 5;
    });
  }

  if (estimate.projectName) {
    yPos += 2;
    doc.text(`Project: ${estimate.projectName}`, margin, yPos);
  }

  // Estimate Details (right side)
  let rightYPos = 55;
  const rightX = pageWidth - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Estimate #: ${estimate.number}`, rightX, rightYPos, { align: "right" });

  rightYPos += 6;
  doc.setFont("helvetica", "normal");
  const statusText = estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1);
  doc.text(`Status: ${statusText}`, rightX, rightYPos, { align: "right" });

  rightYPos += 6;
  doc.text(`Date: ${new Date(estimate.createdAt).toLocaleDateString()}`, rightX, rightYPos, { align: "right" });

  rightYPos += 6;
  doc.text(`Valid Until: ${new Date(estimate.validUntil).toLocaleDateString()}`, rightX, rightYPos, { align: "right" });

  if (estimate.salesRepName) {
    rightYPos += 6;
    doc.text(`Sales Rep: ${estimate.salesRepName}`, rightX, rightYPos, { align: "right" });
  }

  // Use the max of left and right positions
  yPos = Math.max(yPos, rightYPos) + 15;

  // ==================== LINE ITEMS TABLE ====================
  // Table Header
  doc.setFillColor(249, 250, 251);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", margin + 5, yPos + 7);
  doc.text("Qty", pageWidth - 90, yPos + 7);
  doc.text("Unit Price", pageWidth - 65, yPos + 7);
  doc.text("Amount", pageWidth - margin - 5, yPos + 7, { align: "right" });

  yPos += 10;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Line Items
  doc.setFont("helvetica", "normal");
  estimate.lineItems.forEach((item) => {
    checkPageBreak(18);

    yPos += 8;

    const maxDescWidth = pageWidth - 120;
    const displayName = item.productName || item.description;
    const showDescription = item.productName && item.description && item.productName !== item.description;

    // Product name in bold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(displayName, maxDescWidth);

    nameLines.forEach((line: string, index: number) => {
      if (index === 0) {
        doc.text(line, margin + 5, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(item.quantity.toString(), pageWidth - 90, yPos);
        doc.text(`$${item.unitPrice.toFixed(2)}`, pageWidth - 65, yPos);
        doc.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 5, yPos, { align: "right" });
      } else {
        doc.setFont("helvetica", "bold");
        doc.text(line, margin + 5, yPos);
      }
      yPos += 5;
    });

    // Description in smaller gray text (only if different from product name)
    if (showDescription) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(128);
      const descLines = doc.splitTextToSize(item.description, maxDescWidth);
      descLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 4;
      });
      doc.setTextColor(0);
    }

    yPos += 3;
  });

  // Separator line
  yPos += 5;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // ==================== TOTALS SECTION ====================
  yPos += 10;
  checkPageBreak(40);
  const totalsX = pageWidth - 70;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal:", totalsX, yPos);
  doc.text(`$${estimate.subtotal.toFixed(2)}`, pageWidth - margin - 5, yPos, { align: "right" });

  if (estimate.taxRate > 0) {
    yPos += 7;
    doc.text(`Tax (${estimate.taxRate}%):`, totalsX, yPos);
    doc.text(`$${estimate.taxAmount.toFixed(2)}`, pageWidth - margin - 5, yPos, { align: "right" });
  }

  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", totalsX, yPos);
  doc.setTextColor(102, 126, 234); // primary color
  doc.text(`$${estimate.total.toFixed(2)}`, pageWidth - margin - 5, yPos, { align: "right" });

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // ==================== NOTES SECTION ====================
  if (estimate.notes) {
    yPos += 15;
    checkPageBreak(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(estimate.notes, pageWidth - 2 * margin);
    noteLines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, margin, yPos);
      yPos += 5;
    });
  }

  // ==================== FOOTER ====================
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const footerY = pageHeight - 20;
  
  // Use company name or fallback
  const footerText = company.estimate_footer || `${company.company_name || "Command X"} - Project Management System`;
  doc.text(footerText, pageWidth / 2, footerY, { align: "center" });
  doc.text("Thank you for your business!", pageWidth / 2, footerY + 5, { align: "center" });

  // Save the PDF
  doc.save(`Estimate-${estimate.number}.pdf`);
};

// For preview mode with form data
export const generateEstimatePreviewPDF = (
  customerName: string,
  projectName: string | null | undefined,
  lineItems: LineItem[],
  taxRate: number,
  notes: string | null | undefined,
  validUntil: string,
  status: string,
  salesRepName?: string | null,
  companySettings?: CompanySettings | null,
  customerAddress?: string | null
): void => {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxableAmount = lineItems
    .filter(item => item.isTaxable !== false)
    .reduce((sum, item) => sum + item.total, 0);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = subtotal + taxAmount;

  const estimateData: EstimateData = {
    number: "PREVIEW",
    customerName: customerName || "Customer",
    customerAddress,
    projectName,
    status,
    createdAt: new Date().toISOString(),
    validUntil,
    notes,
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    total,
    salesRepName,
    companySettings,
  };

  generateEstimatePDF(estimateData);
};
