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

interface EstimateData {
  number: string;
  customerName: string;
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
}

export const generateEstimatePDF = (estimate: EstimateData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("ESTIMATE", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Estimate number and status
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Estimate #: ${estimate.number}`, margin, yPosition);
  
  // Status badge
  const statusText = estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1);
  doc.text(`Status: ${statusText}`, pageWidth - margin, yPosition, { align: "right" });
  yPosition += 10;

  // Dates
  doc.setFontSize(10);
  doc.text(`Created: ${new Date(estimate.createdAt).toLocaleDateString()}`, margin, yPosition);
  doc.text(`Valid Until: ${new Date(estimate.validUntil).toLocaleDateString()}`, pageWidth - margin, yPosition, { align: "right" });
  yPosition += 15;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Customer Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", margin, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  doc.text(estimate.customerName, margin, yPosition);
  yPosition += 6;
  if (estimate.projectName) {
    doc.setFontSize(10);
    doc.text(`Project: ${estimate.projectName}`, margin, yPosition);
    yPosition += 6;
  }
  yPosition += 10;

  // Line Items Header
  checkPageBreak(30);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, 8, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 2, yPosition);
  doc.text("Qty", pageWidth - margin - 80, yPosition, { align: "right" });
  doc.text("Unit Price", pageWidth - margin - 45, yPosition, { align: "right" });
  doc.text("Total", pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 8;

  // Line Items
  estimate.lineItems.forEach((item) => {
    checkPageBreak(18);
    
    const maxDescWidth = pageWidth - margin - 100;
    const displayName = item.productName || item.description;
    const showDescription = item.productName && item.description && item.productName !== item.description;
    
    // Product name in bold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    const nameLines = doc.splitTextToSize(displayName, maxDescWidth);
    
    nameLines.forEach((line: string, index: number) => {
      if (index === 0) {
        doc.text(line, margin + 2, yPosition);
        doc.text(item.quantity.toString(), pageWidth - margin - 80, yPosition, { align: "right" });
        doc.text(`$${item.unitPrice.toFixed(2)}`, pageWidth - margin - 45, yPosition, { align: "right" });
        doc.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
      } else {
        doc.text(line, margin + 2, yPosition);
      }
      yPosition += 5;
    });
    
    // Description in smaller gray text (only if different from product name)
    if (showDescription) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(128);
      const descLines = doc.splitTextToSize(item.description, maxDescWidth);
      descLines.forEach((line: string) => {
        doc.text(line, margin + 2, yPosition);
        yPosition += 4;
      });
      doc.setTextColor(0);
    }
    
    yPosition += 3;
  });

  yPosition += 5;

  // Divider before summary
  doc.setDrawColor(200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Summary
  checkPageBreak(40);
  const summaryX = pageWidth - margin - 60;
  
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", summaryX, yPosition);
  doc.text(`$${estimate.subtotal.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 6;

  if (estimate.taxRate > 0) {
    doc.text(`Tax (${estimate.taxRate}%):`, summaryX, yPosition);
    doc.text(`$${estimate.taxAmount.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
    yPosition += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", summaryX, yPosition);
  doc.text(`$${estimate.total.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: "right" });
  yPosition += 15;

  // Notes
  if (estimate.notes) {
    checkPageBreak(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, yPosition);
    yPosition += 6;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(estimate.notes, pageWidth - 2 * margin);
    noteLines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

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
  status: string
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
  };

  generateEstimatePDF(estimateData);
};
