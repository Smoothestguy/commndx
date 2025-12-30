import jsPDF from "jspdf";
import { InvoiceWithLineItems } from "@/integrations/supabase/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import {
  PDF_COLORS,
  PDF_FONTS,
  PDF_MARGIN,
  formatCurrencyForPDF,
  setColor,
  setFillColor,
  drawFooter,
  getDefaultCompanyInfo,
  CompanyInfo,
} from "./pdfHelpers";

// Fetch order numbers and info for the invoice
async function fetchOrderInfo(invoice: InvoiceWithLineItems) {
  const orderInfo = {
    jobOrderNumber: null as string | null,
    changeOrderNumber: null as string | null,
    changeOrderReason: null as string | null,
    tmTicketNumber: null as string | null,
  };

  // Cast to access additional fields that may exist on the invoice
  const invoiceData = invoice as InvoiceWithLineItems & { 
    tm_ticket_id?: string | null;
    change_order_id?: string | null;
  };

  // First check if job_order_number is already on the invoice
  if (invoice.job_order_number) {
    orderInfo.jobOrderNumber = invoice.job_order_number;
  } else if (invoice.job_order_id) {
    const { data } = await supabase
      .from("job_orders")
      .select("number")
      .eq("id", invoice.job_order_id)
      .single();
    if (data) orderInfo.jobOrderNumber = data.number;
  }

  if (invoiceData.change_order_id) {
    const { data } = await supabase
      .from("change_orders")
      .select("number, reason")
      .eq("id", invoiceData.change_order_id)
      .single();
    if (data) {
      orderInfo.changeOrderNumber = data.number;
      orderInfo.changeOrderReason = data.reason;
    }
  }

  if (invoiceData.tm_ticket_id) {
    const { data } = await supabase
      .from("tm_tickets")
      .select("ticket_number")
      .eq("id", invoiceData.tm_ticket_id)
      .single();
    if (data) orderInfo.tmTicketNumber = data.ticket_number;
  }

  return orderInfo;
}

export const generateInvoicePDF = async (
  invoice: InvoiceWithLineItems,
  companyInfo?: CompanyInfo | null
): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const company = companyInfo || getDefaultCompanyInfo();

  let yPos = PDF_MARGIN;

  // ==================== HEADER SECTION ====================
  // "INVOICE" title on left
  setColor(doc, PDF_COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", PDF_MARGIN, yPos + 8);

  // Company info on right side
  const rightX = pageWidth - PDF_MARGIN;
  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(PDF_FONTS.body);
  doc.setFont("helvetica", "bold");
  doc.text(company.company_name, rightX, yPos, { align: "right" });
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  setColor(doc, PDF_COLORS.gray600);
  
  // Full company address
  if (company.address) {
    doc.text(company.address, rightX, yPos, { align: "right" });
    yPos += 4;
  }
  
  // City, State ZIP
  const cityStateZip = [company.city, company.state, company.zip].filter(Boolean).join(", ");
  if (cityStateZip) {
    doc.text(cityStateZip, rightX, yPos, { align: "right" });
    yPos += 4;
  }
  
  // Contact info
  if (company.email) {
    doc.text(company.email, rightX, yPos, { align: "right" });
    yPos += 4;
  }
  if (company.phone) {
    doc.text(company.phone, rightX, yPos, { align: "right" });
    yPos += 4;
  }
  if (company.website) {
    doc.text(company.website, rightX, yPos, { align: "right" });
    yPos += 4;
  }

  yPos = Math.max(yPos, PDF_MARGIN + 20) + 12;

  // ==================== BILL TO / INVOICE DETAILS SECTION ====================
  const halfWidth = (pageWidth - 2 * PDF_MARGIN) / 2;
  const boxHeight = 45;

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
  doc.setFontSize(PDF_FONTS.body);
  doc.text(invoice.customer_name, PDF_MARGIN + 5, billToY);
  billToY += 6;

  // Project name (center area if available)
  if (invoice.project_name) {
    setColor(doc, PDF_COLORS.gray600);
    doc.setFontSize(PDF_FONTS.small);
    doc.text(`Project: ${invoice.project_name}`, PDF_MARGIN + 5, billToY);
    billToY += 5;
  }

  if (invoice.job_order_number) {
    setColor(doc, PDF_COLORS.gray600);
    doc.setFontSize(PDF_FONTS.small);
    doc.text(`Job Order: ${invoice.job_order_number}`, PDF_MARGIN + 5, billToY);
  }

  // Invoice Details (right column)
  const detailsX = pageWidth - PDF_MARGIN - 5;
  let detailsY = yPos + 8;
  
  setColor(doc, PDF_COLORS.gray600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  doc.text("Invoice details", detailsX, detailsY, { align: "right" });
  detailsY += 7;

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);
  doc.text(`Invoice no. ${invoice.number}`, detailsX, detailsY, { align: "right" });
  detailsY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  setColor(doc, PDF_COLORS.gray600);
  doc.text(`Invoice date: ${new Date(invoice.created_at).toLocaleDateString()}`, detailsX, detailsY, { align: "right" });
  detailsY += 5;
  doc.text(`Due date: ${new Date(invoice.due_date).toLocaleDateString()}`, detailsX, detailsY, { align: "right" });

  yPos += boxHeight + 12;

  // ==================== LINE ITEMS TABLE ====================
  // Table header with columns: #, Product/Service, Description, Qty, Rate, Amount
  const colNum = PDF_MARGIN + 5;
  const colProduct = PDF_MARGIN + 15;
  const colDescription = PDF_MARGIN + 60;
  const colQty = pageWidth - 85;
  const colRate = pageWidth - 60;
  const colAmount = pageWidth - PDF_MARGIN - 5;

  // Header background
  setFillColor(doc, PDF_COLORS.primary);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, 10, "F");

  // Header text
  setColor(doc, { r: 255, g: 255, b: 255 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.small);
  doc.text("#", colNum, yPos + 7);
  doc.text("Product/Service", colProduct, yPos + 7);
  doc.text("Description", colDescription, yPos + 7);
  doc.text("Qty", colQty, yPos + 7);
  doc.text("Rate", colRate + 15, yPos + 7, { align: "right" });
  doc.text("Amount", colAmount, yPos + 7, { align: "right" });

  yPos += 14;

  // Line Items
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "normal");
  
  // Fetch order info for product name assignment
  const orderInfo = await fetchOrderInfo(invoice);

  invoice.line_items.forEach((item, index) => {
    // Check for page break
    if (yPos > 250) {
      doc.addPage();
      yPos = PDF_MARGIN;
    }

    const rowY = yPos;
    
    // Row number
    doc.text((index + 1).toString(), colNum, rowY);
    
    // Product/Service name - use product_name or derive from order info
    let productName = (item as any).product_name;
    let displayDescription = item.description;

    if (!productName) {
      // Try to identify the source of this line item
      if (orderInfo.changeOrderNumber && orderInfo.changeOrderReason && 
          item.description.trim().toLowerCase() === orderInfo.changeOrderReason.trim().toLowerCase()) {
        productName = `Change Order ${orderInfo.changeOrderNumber}`;
      } else if (orderInfo.tmTicketNumber) {
        productName = `T&M Ticket ${orderInfo.tmTicketNumber}`;
      } else if (orderInfo.jobOrderNumber) {
        productName = `Job Order ${orderInfo.jobOrderNumber}`;
      }
    }
    
    productName = productName || "-";
    const productMaxWidth = 40;
    const productLines = doc.splitTextToSize(productName, productMaxWidth);
    doc.text(productLines[0] || "-", colProduct, rowY);
    
    // Description (truncated if too long)
    const descMaxWidth = colQty - colDescription - 5;
    const descLines = doc.splitTextToSize(displayDescription, descMaxWidth);
    doc.text(descLines[0] || "", colDescription, rowY);
    if (descLines.length > 1) {
      doc.setFontSize(7);
      doc.text(descLines[1], colDescription, rowY + 4);
      doc.setFontSize(PDF_FONTS.small);
    }
    
    // Quantity
    doc.text(item.quantity.toString(), colQty, rowY);
    
    // Rate (unit price) - right aligned
    doc.text(formatCurrencyForPDF(item.unit_price), colRate + 15, rowY, { align: "right" });
    
    // Amount
    doc.text(formatCurrencyForPDF(item.total), colAmount, rowY, { align: "right" });

    yPos += descLines.length > 1 ? 12 : 8;
  });

  // Separator line
  yPos += 3;
  setColor(doc, PDF_COLORS.gray400);
  doc.setLineWidth(0.5);
  doc.line(PDF_MARGIN, yPos, pageWidth - PDF_MARGIN, yPos);
  yPos += 8;

  // ==================== TOTALS SECTION ====================
  const totalsX = pageWidth - PDF_MARGIN - 60;
  const totalsValueX = pageWidth - PDF_MARGIN - 5;

  // Subtotal
  setColor(doc, PDF_COLORS.gray600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.body);
  doc.text("Subtotal", totalsX, yPos);
  setColor(doc, PDF_COLORS.black);
  doc.text(formatCurrencyForPDF(invoice.subtotal), totalsValueX, yPos, { align: "right" });
  yPos += 7;

  // Tax
  setColor(doc, PDF_COLORS.gray600);
  doc.text(`Tax (${invoice.tax_rate}%)`, totalsX, yPos);
  setColor(doc, PDF_COLORS.black);
  doc.text(formatCurrencyForPDF(invoice.tax_amount), totalsValueX, yPos, { align: "right" });
  yPos += 10;

  // Total with highlight
  setFillColor(doc, PDF_COLORS.primaryLight);
  doc.rect(totalsX - 5, yPos - 5, pageWidth - PDF_MARGIN - totalsX + 10, 12, "F");
  
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TOTAL", totalsX, yPos + 3);
  doc.text(formatCurrencyForPDF(invoice.total), totalsValueX, yPos + 3, { align: "right" });
  
  yPos += 15;

  // Balance Due (if there's a paid amount)
  if (Number(invoice.paid_amount) > 0) {
    yPos += 5;
    setColor(doc, PDF_COLORS.success);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_FONTS.body);
    doc.text("Paid", totalsX, yPos);
    doc.text(`-${formatCurrencyForPDF(Number(invoice.paid_amount))}`, totalsValueX, yPos, { align: "right" });
    yPos += 8;
    
    setColor(doc, PDF_COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Balance Due", totalsX, yPos);
    doc.text(formatCurrencyForPDF(Number(invoice.remaining_amount)), totalsValueX, yPos, { align: "right" });
    yPos += 10;
  }

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
