import jsPDF from "jspdf";

const formatCurrencyForPDF = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

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
  customerPhone?: string | null;
  customerEmail?: string | null;
  jobsiteAddress?: string | null;
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
  creatorEmail?: string | null;
  companySettings?: CompanySettings | null;
}

export const generateEstimatePDF = async (estimate: EstimateData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Company settings with fallback
  const company = estimate.companySettings || {
    company_name: "Fairfield Group",
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
  let yPos = 20;
  const headerRightX = pageWidth - margin;
  let logoHeight = 12;

  // Load and add company logo (top-right)
  try {
    const logoUrl = "/images/company-logo.png";
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    
    // Add logo to top-right corner
    const logoWidth = 45;
    logoHeight = 12;
    const logoX = pageWidth - margin - logoWidth;
    doc.addImage(base64, "PNG", logoX, yPos - 5, logoWidth, logoHeight);
  } catch (error) {
    console.error("Failed to load logo:", error);
  }

  // "ESTIMATE" title - blue, top-left
  doc.setTextColor(37, 99, 235); // #2563EB blue
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ESTIMATE", margin, yPos);

  // Right column - contact info stacked and right-aligned under logo
  let contactYPos = yPos + logoHeight + 3;
  doc.setTextColor(75, 85, 99); // gray-600
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  if (company.email) {
    doc.text(company.email, headerRightX, contactYPos, { align: "right" });
    contactYPos += 4;
  }
  if (company.phone) {
    doc.text(company.phone, headerRightX, contactYPos, { align: "right" });
    contactYPos += 4;
  }
  if (company.website) {
    doc.text(company.website, headerRightX, contactYPos, { align: "right" });
  }

  yPos += 10;

  // Company Name (bold, black) - left column
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(company.company_name || "Command X", margin, yPos);

  yPos += 5;

  // Address line (left column)
  doc.setTextColor(75, 85, 99);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (company.address) {
    doc.text(company.address, margin, yPos);
    yPos += 5;
  }

  // City, State ZIP (left column)
  if (company.city || company.state || company.zip) {
    const cityStateZip = [company.city, company.state, company.zip].filter(Boolean).join(", ");
    doc.text(cityStateZip, margin, yPos);
  }

  yPos += 10;

  // ==================== BILL TO / SHIP TO SECTION (Light blue background) ====================
  // Calculate required height based on content
  const hasJobsiteAddress = !!estimate.jobsiteAddress;
  const billToHeight = hasJobsiteAddress ? 45 : 40;
  doc.setFillColor(239, 246, 255); // light blue bg (#EFF6FF)
  doc.rect(margin, yPos, pageWidth - 2 * margin, billToHeight, "F");

  const halfWidth = (pageWidth - 2 * margin) / 2;
  let billToY = yPos + 8;

  // Bill to label
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Bill to", margin + 5, billToY);

  billToY += 6;

  // Customer name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(estimate.customerName, margin + 5, billToY);
  billToY += 5;

  // Customer address (if available)
  if (estimate.customerAddress) {
    billToY += 5;
    doc.setTextColor(75, 85, 99);
    const addressLines = doc.splitTextToSize(estimate.customerAddress, halfWidth - 15);
    addressLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, margin + 5, billToY);
      billToY += 4;
    });
  }

  // Customer phone
  if (estimate.customerPhone) {
    doc.setTextColor(75, 85, 99);
    doc.text(estimate.customerPhone, margin + 5, billToY);
    billToY += 4;
  }

  // Customer email
  if (estimate.customerEmail) {
    doc.setTextColor(75, 85, 99);
    doc.text(estimate.customerEmail, margin + 5, billToY);
  }

  // Ship to / Jobsite section (right column)
  if (hasJobsiteAddress) {
    let shipToY = yPos + 8;
    const shipToX = margin + halfWidth + 5;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Ship to / Jobsite", shipToX, shipToY);

    shipToY += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    const jobsiteLines = doc.splitTextToSize(estimate.jobsiteAddress!, halfWidth - 15);
    jobsiteLines.slice(0, 4).forEach((line: string) => {
      doc.text(line, shipToX, shipToY);
      shipToY += 4;
    });
  }

  yPos += billToHeight + 5;

  // Dashed divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  doc.setLineDashPattern([], 0);

  yPos += 8;

  // ==================== DETAILS SECTION ====================
  // Left side - Estimate details
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Estimate details", margin, yPos);

  // Right side - Project info (stacked vertically to prevent overlap)
  const rightX = pageWidth - margin;
  let rightYPos = yPos;
  
  if (estimate.projectName) {
    doc.setFontSize(9);
    doc.text("Project Name:", rightX, rightYPos, { align: "right" });
    rightYPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    // Wrap long project names to prevent overflow
    const maxProjectWidth = 70;
    const projectNameLines = doc.splitTextToSize(estimate.projectName, maxProjectWidth);
    doc.text(projectNameLines, rightX, rightYPos, { align: "right" });
    rightYPos += projectNameLines.length * 4 + 3;
  }
  
  // Created by on right (below project name)
  if (estimate.salesRepName) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Created by:", rightX, rightYPos, { align: "right" });
    rightYPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    doc.text(estimate.salesRepName, rightX, rightYPos, { align: "right" });
    if (estimate.creatorEmail) {
      rightYPos += 5;
      doc.text(estimate.creatorEmail, rightX, rightYPos, { align: "right" });
    }
  }

  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);

  // Estimate number
  doc.text(`Estimate no.: ${estimate.number}`, margin, yPos);

  yPos += 5;
  doc.text(`Estimate date: ${new Date(estimate.createdAt).toLocaleDateString()}`, margin, yPos);

  yPos += 5;
  doc.text(`Valid until: ${new Date(estimate.validUntil).toLocaleDateString()}`, margin, yPos);

  yPos += 12;

  // ==================== LINE ITEMS TABLE ====================
  // Table Header
  doc.setFillColor(249, 250, 251);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", margin + 5, yPos + 7);
  doc.text("Qty", pageWidth - 55, yPos + 7);
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

    const maxDescWidth = pageWidth - 90;
    const displayName = item.productName || item.description;
    const showDescription = item.productName && item.description && item.productName !== item.description;

    // Product name in bold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(displayName, maxDescWidth);

    nameLines.forEach((line: string, index: number) => {
      checkPageBreak(6); // Check before each line to prevent cutoff
      if (index === 0) {
        doc.text(line, margin + 5, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(item.quantity.toString(), pageWidth - 55, yPos);
        doc.text(formatCurrencyForPDF(item.total), pageWidth - margin - 5, yPos, { align: "right" });
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
        checkPageBreak(5); // Check before each description line
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
  doc.text(formatCurrencyForPDF(estimate.subtotal), pageWidth - margin - 5, yPos, { align: "right" });

  if (estimate.taxRate > 0) {
    yPos += 7;
    doc.text(`Tax (${estimate.taxRate}%):`, totalsX, yPos);
    doc.text(formatCurrencyForPDF(estimate.taxAmount), pageWidth - margin - 5, yPos, { align: "right" });
  }

  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", totalsX, yPos);
  doc.setTextColor(102, 126, 234); // primary color
  doc.text(formatCurrencyForPDF(estimate.total), pageWidth - margin - 5, yPos, { align: "right" });

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

  // ==================== FOOTER ON ALL PAGES ====================
  const totalPages = doc.getNumberOfPages();
  const footerText = company.estimate_footer || `${company.company_name || "Fairfield Group"} - Project Management System`;
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    const footerY = pageHeight - 20;
    doc.text(footerText, pageWidth / 2, footerY, { align: "center" });
    doc.text("Thank you for your business!", pageWidth / 2, footerY + 5, { align: "center" });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, footerY + 10, { align: "center" });
  }

  // Save the PDF
  doc.save(`Estimate-${estimate.number}.pdf`);
};

// For preview mode with form data
export const generateEstimatePreviewPDF = async (
  customerName: string,
  projectName: string | null | undefined,
  lineItems: LineItem[],
  taxRate: number,
  notes: string | null | undefined,
  validUntil: string,
  status: string,
  salesRepName?: string | null,
  companySettings?: CompanySettings | null,
  customerAddress?: string | null,
  customerPhone?: string | null,
  customerEmail?: string | null,
  jobsiteAddress?: string | null
): Promise<void> => {
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
    customerPhone,
    customerEmail,
    jobsiteAddress,
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

  await generateEstimatePDF(estimateData);
};
