import jsPDF from "jspdf";
import { InvoiceWithLineItems } from "@/integrations/supabase/hooks/useInvoices";
import {
  PDF_COLORS,
  PDF_FONTS,
  PDF_MARGIN,
  formatCurrencyForPDF,
  setColor,
  setFillColor,
  setDrawColor,
  drawDocumentHeader,
  drawTableHeader,
  drawSeparatorLine,
  drawTotalsSection,
  drawFooter,
  getDefaultCompanyInfo,
  CompanyInfo,
} from "./pdfHelpers";

export const generateInvoicePDF = async (
  invoice: InvoiceWithLineItems,
  companyInfo?: CompanyInfo | null
): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const company = companyInfo || getDefaultCompanyInfo();

  // Draw header with logo
  let yPos = await drawDocumentHeader(doc, "Invoice", company);

  // ==================== BILL TO / INVOICE DETAILS SECTION ====================
  const halfWidth = (pageWidth - 2 * PDF_MARGIN) / 2;
  const boxHeight = 40;

  // Light blue background
  setFillColor(doc, PDF_COLORS.primaryLight);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, boxHeight, "F");

  // Bill To (left column)
  let billToY = yPos + 8;
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);
  doc.text("Bill to", PDF_MARGIN + 5, billToY);
  billToY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  doc.text(invoice.customer_name, PDF_MARGIN + 5, billToY);
  billToY += 5;

  if (invoice.project_name) {
    setColor(doc, PDF_COLORS.gray600);
    doc.text(`Project: ${invoice.project_name}`, PDF_MARGIN + 5, billToY);
    billToY += 5;
  }

  if (invoice.job_order_number) {
    setColor(doc, PDF_COLORS.gray600);
    doc.text(`Job Order: ${invoice.job_order_number}`, PDF_MARGIN + 5, billToY);
  }

  // Invoice Details (right column)
  let detailsY = yPos + 8;
  const rightX = pageWidth - PDF_MARGIN - 5;
  
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.small);
  doc.text(`Invoice #: ${invoice.number}`, rightX, detailsY, { align: "right" });
  detailsY += 5;

  doc.setFont("helvetica", "normal");
  setColor(doc, PDF_COLORS.gray600);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, rightX, detailsY, { align: "right" });
  detailsY += 5;
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, rightX, detailsY, { align: "right" });

  yPos += boxHeight + 10;

  // ==================== LINE ITEMS TABLE ====================
  yPos = drawTableHeader(
    doc,
    [
      { label: "Description", x: PDF_MARGIN + 5 },
      { label: "Qty", x: pageWidth - 90 },
      { label: "Unit Price", x: pageWidth - 65 },
      { label: "Amount", x: pageWidth - PDF_MARGIN - 5, align: "right" },
    ],
    yPos
  );

  // Line Items
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "normal");
  invoice.line_items.forEach((item) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = PDF_MARGIN;
    }

    yPos += 8;

    const maxWidth = pageWidth - 120;
    const lines = doc.splitTextToSize(item.description, maxWidth);
    doc.text(lines, PDF_MARGIN + 5, yPos);
    doc.text(item.quantity.toString(), pageWidth - 90, yPos);
    doc.text(formatCurrencyForPDF(item.unit_price), pageWidth - 65, yPos);
    doc.text(formatCurrencyForPDF(item.total), pageWidth - PDF_MARGIN - 5, yPos, { align: "right" });

    yPos += (lines.length - 1) * 5;
  });

  yPos += 5;
  yPos = drawSeparatorLine(doc, yPos);

  // ==================== TOTALS SECTION ====================
  yPos += 5;
  const totals = [
    { label: "Subtotal:", value: invoice.subtotal },
    { label: `Tax (${invoice.tax_rate}%):`, value: invoice.tax_amount },
    { label: "TOTAL:", value: invoice.total, bold: true, highlight: true },
  ];
  yPos = drawTotalsSection(doc, totals, yPos);

  // ==================== PAYMENT STATUS ====================
  if (invoice.status === "paid" && invoice.paid_date) {
    yPos += 10;
    setColor(doc, PDF_COLORS.success);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("✓ PAID", PDF_MARGIN, yPos);
    doc.setFontSize(PDF_FONTS.body);
    doc.setFont("helvetica", "normal");
    doc.text(`Paid on ${new Date(invoice.paid_date).toLocaleDateString()}`, PDF_MARGIN + 30, yPos);
  }

  // ==================== FOOTER ====================
  drawFooter(doc, company.company_name, "Thank you for your business!");

  // Save PDF
  doc.save(`Invoice-${invoice.number}.pdf`);
};
