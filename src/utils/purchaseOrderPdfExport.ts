import jsPDF from "jspdf";
import { PurchaseOrderWithLineItems } from "@/integrations/supabase/hooks/usePurchaseOrders";

const formatCurrencyForPDF = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface POAddendum {
  id: string;
  number: string | null;
  description: string;
  amount: number;
  status?: string;
}

export const generatePurchaseOrderPDF = (
  purchaseOrder: PurchaseOrderWithLineItems,
  addendums?: POAddendum[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Company Header
  doc.setFillColor(102, 126, 234); // primary color
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Fairfield Group", 20, 25);
  
  // PO Title
  doc.setFontSize(16);
  doc.text("PURCHASE ORDER", pageWidth - 20, 25, { align: "right" });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // PO Details (right side)
  let yPos = 55;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`PO #: ${purchaseOrder.number}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date(purchaseOrder.created_at).toLocaleDateString()}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 6;
  doc.text(`Due Date: ${new Date(purchaseOrder.due_date).toLocaleDateString()}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 6;
  doc.text(`Status: ${purchaseOrder.status.replace(/_/g, ' ').toUpperCase()}`, pageWidth - 20, yPos, { align: "right" });
  
  // Vendor Section (left side)
  yPos = 55;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("VENDOR:", 20, yPos);
  
  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(purchaseOrder.vendor_name, 20, yPos);
  
  // Project Info
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PROJECT:", 20, yPos);
  
  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(purchaseOrder.customer_name, 20, yPos);
  
  yPos += 6;
  doc.text(purchaseOrder.project_name, 20, yPos);
  
  yPos += 6;
  doc.text(`Job Order: ${purchaseOrder.job_order_number}`, 20, yPos);
  
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
  purchaseOrder.line_items.forEach((item) => {
    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos += 8;
    
    // Wrap description if too long
    const maxWidth = pageWidth - 120;
    const lines = doc.splitTextToSize(item.description, maxWidth);
    doc.text(lines, 25, yPos);
    
    doc.text(item.quantity.toString(), pageWidth - 90, yPos);
    doc.text(formatCurrencyForPDF(Number(item.unit_price)), pageWidth - 65, yPos);
    doc.text(formatCurrencyForPDF(Number(item.total)), pageWidth - 25, yPos, { align: "right" });
    
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
  doc.text(formatCurrencyForPDF(Number(purchaseOrder.subtotal)), pageWidth - 25, yPos, { align: "right" });
  
  yPos += 7;
  doc.text(`Tax (${purchaseOrder.tax_rate}%):`, totalsX, yPos);
  doc.text(formatCurrencyForPDF(Number(purchaseOrder.tax_amount)), pageWidth - 25, yPos, { align: "right" });
  
  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.text("PO Total:", totalsX, yPos);
  doc.text(formatCurrencyForPDF(Number(purchaseOrder.total)), pageWidth - 25, yPos, { align: "right" });
  
  // Addendums section
  const totalAddendumAmount = Number(purchaseOrder.total_addendum_amount || 0);
  if (totalAddendumAmount > 0 && addendums && addendums.length > 0) {
    yPos += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CHANGE ORDERS / ADDENDUMS", 20, yPos);
    
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    addendums.forEach((addendum) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text(`${addendum.number}: ${addendum.description}`, 25, yPos);
      doc.text(formatCurrencyForPDF(Number(addendum.amount)), pageWidth - 25, yPos, { align: "right" });
      yPos += 6;
    });
    
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Total Addendums:", totalsX, yPos);
    doc.text(formatCurrencyForPDF(totalAddendumAmount), pageWidth - 25, yPos, { align: "right" });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.text("GRAND TOTAL:", totalsX, yPos);
    doc.setTextColor(102, 126, 234);
    doc.text(formatCurrencyForPDF(Number(purchaseOrder.total) + totalAddendumAmount), pageWidth - 25, yPos, { align: "right" });
    doc.setTextColor(0, 0, 0);
  } else {
    yPos += 10;
    doc.setFontSize(12);
    doc.text("TOTAL:", totalsX, yPos);
    doc.setTextColor(102, 126, 234);
    doc.text(formatCurrencyForPDF(Number(purchaseOrder.total)), pageWidth - 25, yPos, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
  
  // Notes
  if (purchaseOrder.notes) {
    yPos += 15;
    
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("NOTES:", 20, yPos);
    
    yPos += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const noteLines = doc.splitTextToSize(purchaseOrder.notes, pageWidth - 40);
    doc.text(noteLines, 20, yPos);
  }
  
  // Footer
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const footerY = doc.internal.pageSize.height - 20;
  doc.text("Fairfield Group - https://fairfieldgp.com/", pageWidth / 2, footerY, { align: "center" });
  
  // Save PDF
  doc.save(`PO-${purchaseOrder.number}.pdf`);
};
