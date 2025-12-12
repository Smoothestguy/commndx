import jsPDF from "jspdf";
import {
  PDF_COLORS,
  PDF_FONTS,
  PDF_MARGIN,
  formatCurrencyForPDF,
  setColor,
  setFillColor,
  setDrawColor,
  loadCompanyLogo,
  drawInstructionsBox,
  drawSignatureLines,
  drawFooter,
  getDefaultCompanyInfo,
  CompanyInfo,
} from "./pdfHelpers";

// ==================== INTERFACES ====================
export interface WorkOrderLineItem {
  lineNumber: number;
  category: string;
  type: string;
  quantityLabel: string;
  productDescription: string;
  colorOrArea?: string;
  price: number;
  total: number;
  notes?: string;
}

export interface WorkOrderPdfData {
  header: {
    locationLabel?: string;
    companyAddress?: string;
    companyPhone?: string;
    soldTo: {
      name: string;
      address1?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone?: string;
    };
    contactName?: string;
    contactPhone?: string;
    shipTo: {
      name: string;
      address1?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone?: string;
    };
    projectName?: string;
    projectNumber?: string;
    workOrderNumber: string;
    jobNumber?: string;
    contractNumber?: string;
    installDate?: string;
    salesPerson?: string;
    laborVendor?: string;
    installer?: string;
  };
  lines: WorkOrderLineItem[];
  laborCostTotal: number;
  installationInstructions?: string;
  jobSiteDirections?: string;
}

// ==================== MAIN PDF GENERATION FUNCTION ====================
export const generateWorkOrderPDF = async (
  data: WorkOrderPdfData,
  companyInfo?: CompanyInfo | null
): Promise<jsPDF> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const company = companyInfo || getDefaultCompanyInfo();
  
  let yPos = 20;
  let logoHeight = 12;

  // ==================== HEADER SECTION ====================
  // Load and add company logo (top-right)
  const logoBase64 = await loadCompanyLogo();
  if (logoBase64) {
    const logoWidth = 45;
    const logoX = pageWidth - PDF_MARGIN - logoWidth;
    doc.addImage(logoBase64, "PNG", logoX, yPos - 5, logoWidth, logoHeight);
  }

  // "WORK ORDER" title - blue, top-left
  setColor(doc, PDF_COLORS.primary);
  doc.setFontSize(PDF_FONTS.title);
  doc.setFont("helvetica", "bold");
  doc.text("WORK ORDER", PDF_MARGIN, yPos);

  // Location label under title
  if (data.header.locationLabel) {
    yPos += 6;
    setColor(doc, PDF_COLORS.gray600);
    doc.setFontSize(PDF_FONTS.small);
    doc.setFont("helvetica", "normal");
    doc.text(data.header.locationLabel, PDF_MARGIN, yPos);
  }

  // Right column - contact info under logo
  let rightY = yPos + logoHeight + 3;
  const rightX = pageWidth - PDF_MARGIN;
  setColor(doc, PDF_COLORS.gray600);
  doc.setFontSize(PDF_FONTS.small);
  
  if (company.email) {
    doc.text(company.email, rightX, rightY, { align: "right" });
    rightY += 4;
  }
  if (company.phone || data.header.companyPhone) {
    doc.text(company.phone || data.header.companyPhone || "", rightX, rightY, { align: "right" });
    rightY += 4;
  }
  if (company.website) {
    doc.text(company.website, rightX, rightY, { align: "right" });
  }

  yPos += 15;

  // Company Name
  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(PDF_FONTS.subheading);
  doc.setFont("helvetica", "bold");
  doc.text(company.company_name, PDF_MARGIN, yPos);

  yPos += 10;

  // ==================== DUAL ADDRESS SECTION ====================
  const halfWidth = (pageWidth - 2 * PDF_MARGIN) / 2;
  const addressBoxHeight = 45;

  // Light blue background
  setFillColor(doc, PDF_COLORS.primaryLight);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, addressBoxHeight, "F");

  // SOLD TO (left column)
  let leftY = yPos + 8;
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);
  doc.text("SOLD TO:", PDF_MARGIN + 5, leftY);
  leftY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  doc.text(data.header.soldTo.name || "", PDF_MARGIN + 5, leftY);
  leftY += 4;

  if (data.header.soldTo.address1) {
    setColor(doc, PDF_COLORS.gray600);
    doc.text(data.header.soldTo.address1, PDF_MARGIN + 5, leftY);
    leftY += 4;
  }

  const soldToCityState = [data.header.soldTo.city, data.header.soldTo.state, data.header.soldTo.zip].filter(Boolean).join(", ");
  if (soldToCityState) {
    doc.text(soldToCityState, PDF_MARGIN + 5, leftY);
    leftY += 4;
  }

  // Contact info
  leftY += 2;
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.text("Contact:", PDF_MARGIN + 5, leftY);
  doc.setFont("helvetica", "normal");
  doc.text(data.header.contactName || "", PDF_MARGIN + 25, leftY);
  leftY += 4;
  if (data.header.contactPhone) {
    setColor(doc, PDF_COLORS.gray600);
    doc.text(`Ph: ${data.header.contactPhone}`, PDF_MARGIN + 5, leftY);
  }

  // SHIP TO (right column)
  let shipToY = yPos + 8;
  const shipToX = PDF_MARGIN + halfWidth + 5;
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);
  doc.text("SHIP TO:", shipToX, shipToY);
  shipToY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  doc.text(data.header.shipTo.name || "", shipToX, shipToY);
  shipToY += 4;

  if (data.header.shipTo.address1) {
    setColor(doc, PDF_COLORS.gray600);
    const shipAddrLines = doc.splitTextToSize(data.header.shipTo.address1, halfWidth - 15);
    shipAddrLines.forEach((line: string) => {
      doc.text(line, shipToX, shipToY);
      shipToY += 4;
    });
  }

  const shipToCityState = [data.header.shipTo.city, data.header.shipTo.state, data.header.shipTo.zip].filter(Boolean).join(", ");
  if (shipToCityState) {
    doc.text(shipToCityState, shipToX, shipToY);
  }

  yPos += addressBoxHeight + 5;

  // ==================== REFERENCE SECTION ====================
  // Gray background for reference info
  setFillColor(doc, PDF_COLORS.gray50);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, 28, "F");

  const refY = yPos + 7;
  const col1X = PDF_MARGIN + 5;
  const col2X = pageWidth / 2;

  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(PDF_FONTS.small);

  // Left column
  doc.setFont("helvetica", "bold");
  doc.text("Project:", col1X, refY);
  doc.setFont("helvetica", "normal");
  doc.text(data.header.projectName || "", col1X + 25, refY);

  doc.setFont("helvetica", "bold");
  doc.text("Job Order #:", col1X, refY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(data.header.jobNumber || "", col1X + 35, refY + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Labor Vendor:", col1X, refY + 14);
  doc.setFont("helvetica", "normal");
  doc.text(data.header.laborVendor || "", col1X + 38, refY + 14);

  // Right column
  doc.setFont("helvetica", "bold");
  doc.text("Work Order #:", col2X, refY);
  doc.setFont("helvetica", "normal");
  setColor(doc, PDF_COLORS.primary);
  doc.text(data.header.workOrderNumber, col2X + 38, refY);

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.text("Install Date:", col2X, refY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(data.header.installDate || "", col2X + 35, refY + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Installer:", col2X, refY + 14);
  doc.setFont("helvetica", "normal");
  doc.text(data.header.installer || "", col2X + 25, refY + 14);

  yPos += 35;

  // ==================== LINE ITEMS TABLE ====================
  // Table Header
  setFillColor(doc, PDF_COLORS.gray50);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, 10, "F");

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);
  doc.text("#", PDF_MARGIN + 5, yPos + 7);
  doc.text("Category", PDF_MARGIN + 15, yPos + 7);
  doc.text("Description", PDF_MARGIN + 55, yPos + 7);
  doc.text("Qty", pageWidth - 95, yPos + 7, { align: "right" });
  doc.text("Price", pageWidth - 55, yPos + 7, { align: "right" });
  doc.text("Total", pageWidth - PDF_MARGIN - 5, yPos + 7, { align: "right" });

  yPos += 10;

  // Line Items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);

  let currentCategory = "";

  data.lines.forEach((item) => {
    // Check page break
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = PDF_MARGIN;
    }

    // Category header if changed
    if (item.category !== currentCategory) {
      yPos += 3;
      setColor(doc, PDF_COLORS.primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(PDF_FONTS.small);
      doc.text(item.category.toUpperCase(), PDF_MARGIN + 15, yPos + 5);
      currentCategory = item.category;
      yPos += 8;
    }

    yPos += 6;
    setColor(doc, PDF_COLORS.black);
    doc.setFont("helvetica", "normal");

    // Line number
    doc.text(item.lineNumber.toString(), PDF_MARGIN + 5, yPos);

    // Description (wrapped) - reduced width to prevent overlap with Qty column
    // Description starts at PDF_MARGIN + 55, Qty right-aligns at pageWidth - 95
    // Leave ~15px gap before Qty column
    const maxDescWidth = pageWidth - 170;
    const descLines = doc.splitTextToSize(item.productDescription, maxDescWidth);
    doc.text(descLines[0] || "", PDF_MARGIN + 55, yPos);

    // Quantity - right-aligned
    doc.text(item.quantityLabel, pageWidth - 95, yPos, { align: "right" });

    // Price - right-aligned
    doc.text(formatCurrencyForPDF(item.price), pageWidth - 55, yPos, { align: "right" });

    // Total - right-aligned
    doc.text(formatCurrencyForPDF(item.total), pageWidth - PDF_MARGIN - 5, yPos, { align: "right" });

    // Additional description lines
    if (descLines.length > 1) {
      descLines.slice(1).forEach((line: string) => {
        yPos += 4;
        setColor(doc, PDF_COLORS.gray600);
        doc.text(line, PDF_MARGIN + 55, yPos);
      });
    }

    setColor(doc, PDF_COLORS.black);
  });

  // Separator line
  yPos += 5;
  setDrawColor(doc, PDF_COLORS.gray200);
  doc.line(PDF_MARGIN, yPos, pageWidth - PDF_MARGIN, yPos);

  // ==================== LABOR COST TOTAL ====================
  yPos += 10;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.heading);
  // Right-align label at one position, value at another with clear spacing
  doc.text("LABOR TOTAL:", pageWidth - 70, yPos, { align: "right" });
  setColor(doc, PDF_COLORS.primary);
  doc.text(formatCurrencyForPDF(data.laborCostTotal), pageWidth - 20, yPos, { align: "right" });

  yPos += 15;

  // ==================== INSTALLATION INSTRUCTIONS ====================
  if (data.installationInstructions) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = PDF_MARGIN;
    }
    yPos = drawInstructionsBox(doc, "INSTALLATION INSTRUCTIONS:", data.installationInstructions, yPos);
  }

  // ==================== JOBSITE DIRECTIONS ====================
  if (data.jobSiteDirections) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = PDF_MARGIN;
    }
    yPos = drawInstructionsBox(doc, "JOBSITE DIRECTIONS:", data.jobSiteDirections, yPos);
  }

  // ==================== SIGNATURE SECTION ====================
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = PDF_MARGIN;
  }
  
  yPos += 10;
  drawSignatureLines(doc, ["Installer Signature", "Supervisor Signature"], yPos);

  // ==================== FOOTER ====================
  drawFooter(doc, company.company_name);

  return doc;
};

// ==================== PRINT WORK ORDER ====================
export const printWorkOrderPDF = async (
  data: WorkOrderPdfData,
  companyInfo?: CompanyInfo | null
): Promise<void> => {
  const doc = await generateWorkOrderPDF(data, companyInfo);
  
  // Use jsPDF's autoPrint to embed print command in PDF
  doc.autoPrint();
  
  // Open in new window - PDF will auto-trigger print dialog
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

// ==================== DOWNLOAD WORK ORDER ====================
export const downloadWorkOrderPDF = async (
  data: WorkOrderPdfData,
  companyInfo?: CompanyInfo | null
): Promise<void> => {
  const doc = await generateWorkOrderPDF(data, companyInfo);
  doc.save(`Work-Order-${data.header.workOrderNumber}.pdf`);
};

// ==================== HELPER TO MAP PO TO WORK ORDER ====================
export interface MapWorkOrderParams {
  purchaseOrder: {
    number: string;
    vendor_name: string;
    customer_name: string;
    project_name: string;
    job_order_number: string;
    due_date: string;
    total: number;
    total_addendum_amount?: number;
    notes?: string | null;
    line_items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>;
  };
  project?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    poc_name?: string | null;
    poc_phone?: string | null;
    start_date?: string | null;
  } | null;
  installationInstructions?: string;
  jobSiteDirections?: string;
}

export const mapPurchaseOrderToWorkOrder = (params: MapWorkOrderParams): WorkOrderPdfData => {
  const { purchaseOrder, project, installationInstructions, jobSiteDirections } = params;

  const lines: WorkOrderLineItem[] = purchaseOrder.line_items.map((item, index) => ({
    lineNumber: index + 1,
    category: "Work Item",
    type: "Labor",
    quantityLabel: item.quantity.toString(),
    productDescription: item.description,
    price: Number(item.unit_price),
    total: Number(item.total),
  }));

  const laborCostTotal = Number(purchaseOrder.total) + Number(purchaseOrder.total_addendum_amount || 0);

  return {
    header: {
      locationLabel: project?.city && project?.state ? `${project.city}, ${project.state}` : undefined,
      soldTo: {
        name: purchaseOrder.customer_name,
      },
      contactName: project?.poc_name || undefined,
      contactPhone: project?.poc_phone || undefined,
      shipTo: {
        name: purchaseOrder.project_name,
        address1: project?.address || undefined,
        city: project?.city || undefined,
        state: project?.state || undefined,
        zip: project?.zip || undefined,
      },
      projectName: purchaseOrder.project_name,
      projectNumber: purchaseOrder.job_order_number,
      workOrderNumber: purchaseOrder.number,
      jobNumber: purchaseOrder.job_order_number,
      installDate: project?.start_date 
        ? new Date(project.start_date).toLocaleDateString() 
        : new Date(purchaseOrder.due_date).toLocaleDateString(),
      laborVendor: purchaseOrder.vendor_name,
      installer: purchaseOrder.vendor_name,
    },
    lines,
    laborCostTotal,
    installationInstructions: installationInstructions || purchaseOrder.notes || undefined,
    jobSiteDirections,
  };
};
