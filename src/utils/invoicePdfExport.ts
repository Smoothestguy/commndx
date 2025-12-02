import jsPDF from "jspdf";
import { InvoiceWithLineItems } from "@/integrations/supabase/hooks/useInvoices";

export const generateInvoicePDF = (invoice: InvoiceWithLineItems) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Company Header
  doc.setFillColor(102, 126, 234); // primary color
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Command X", 20, 25);
  
  // Invoice Title
  doc.setFontSize(16);
  doc.text("INVOICE", pageWidth - 20, 25, { align: "right" });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Invoice Details
  let yPos = 55;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice #: ${invoice.number}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 6;
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - 20, yPos, { align: "right" });
  
  // Bill To Section
  yPos = 55;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("BILL TO:", 20, yPos);
  
  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.customer_name, 20, yPos);
  
  if (invoice.project_name) {
    yPos += 6;
    doc.text(`Project: ${invoice.project_name}`, 20, yPos);
  }
  
  if (invoice.job_order_number) {
    yPos += 6;
    doc.text(`Job Order: ${invoice.job_order_number}`, 20, yPos);
  }
  
  // Line Items Table
  yPos += 15;
  
  // Table Header
  doc.setFillColor(249, 250, 251);
  doc.rect(20, yPos, pageWidth - 40, 10, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", 25, yPos + 7);
  doc.text("Qty", pageWidth - 90, yPos + 7);
  doc.text("Unit Price", pageWidth - 65, yPos + 7);
  doc.text("Amount", pageWidth - 25, yPos + 7, { align: "right" });
  
  yPos += 10;
  
  // Line Items
  doc.setFont("helvetica", "normal");
  invoice.line_items.forEach((item) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos += 8;
    
    // Wrap description if too long
    const maxWidth = pageWidth - 120;
    const lines = doc.splitTextToSize(item.description, maxWidth);
    doc.text(lines, 25, yPos);
    
    doc.text(item.quantity.toString(), pageWidth - 90, yPos);
    doc.text(`$${item.unit_price.toFixed(2)}`, pageWidth - 65, yPos);
    doc.text(`$${item.total.toFixed(2)}`, pageWidth - 25, yPos, { align: "right" });
    
    yPos += (lines.length - 1) * 5;
  });
  
  // Separator line
  yPos += 5;
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  // Totals Section
  yPos += 10;
  const totalsX = pageWidth - 70;
  
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totalsX, yPos);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - 25, yPos, { align: "right" });
  
  yPos += 7;
  doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, yPos);
  doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - 25, yPos, { align: "right" });
  
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", totalsX, yPos);
  doc.setTextColor(102, 126, 234); // primary color
  doc.text(`$${invoice.total.toFixed(2)}`, pageWidth - 25, yPos, { align: "right" });
  
  // Payment Status
  if (invoice.status === "paid" && invoice.paid_date) {
    yPos += 15;
    doc.setTextColor(34, 197, 94); // green
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("✓ PAID", 20, yPos);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Paid on ${new Date(invoice.paid_date).toLocaleDateString()}`, 50, yPos);
  }
  
  // Footer
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const footerY = doc.internal.pageSize.height - 20;
  doc.text("Command X - Project Management System", pageWidth / 2, footerY, { align: "center" });
  doc.text("Thank you for your business!", pageWidth / 2, footerY + 5, { align: "center" });
  
  // Save PDF
  doc.save(`Invoice-${invoice.number}.pdf`);
};
