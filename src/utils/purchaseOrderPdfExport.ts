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

export interface ProjectInfoForPDF {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

export const generatePurchaseOrderPDF = (
  purchaseOrder: PurchaseOrderWithLineItems,
  addendums?: POAddendum[],
  projectInfo?: ProjectInfoForPDF
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
  
  // PO Details (top right, below header)
  let yPos = 50;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`PO #: ${purchaseOrder.number}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date(purchaseOrder.created_at).toLocaleDateString()}`, pageWidth - 20, yPos, { align: "right" });
  
  yPos += 5;
  doc.text(`Due Date: ${new Date(purchaseOrder.due_date).toLocaleDateString()}`, pageWidth - 20, yPos, { align: "right" });
  
  // Left Column - Vendor & Project Info
  let leftYPos = 50;
  const leftColX = 20;
  const midColX = pageWidth / 3 + 5;
  
  // Vendor Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VENDOR:", leftColX, leftYPos);
  doc.setFont("helvetica", "normal");
  doc.text(purchaseOrder.vendor_name, leftColX, leftYPos + 5);
  
  // Sold To / Customer
  leftYPos += 14;
  doc.setFont("helvetica", "bold");
  doc.text("SOLD TO:", leftColX, leftYPos);
  doc.setFont("helvetica", "normal");
  doc.text(purchaseOrder.customer_name, leftColX, leftYPos + 5);
  
  // Project Name
  leftYPos += 14;
  doc.setFont("helvetica", "bold");
  doc.text("PROJECT:", leftColX, leftYPos);
  doc.setFont("helvetica", "normal");
  const projectNameLines = doc.splitTextToSize(purchaseOrder.project_name, 55);
  doc.text(projectNameLines, leftColX, leftYPos + 5);
  
  // Job Order Reference
  leftYPos += 10 + (projectNameLines.length - 1) * 4;
  doc.setFont("helvetica", "bold");
  doc.text("JOB ORDER:", leftColX, leftYPos);
  doc.setFont("helvetica", "normal");
  doc.text(purchaseOrder.job_order_number, leftColX, leftYPos + 5);
  
  // Middle Column - Ship To / Project Address
  let midYPos = 50;
  doc.setFont("helvetica", "bold");
  doc.text("SHIP TO:", midColX, midYPos);
  doc.setFont("helvetica", "normal");
  midYPos += 5;
  
  if (projectInfo?.address) {
    const addressLines = doc.splitTextToSize(projectInfo.address, 55);
    doc.text(addressLines, midColX, midYPos);
    midYPos += addressLines.length * 4;
    
    const cityStateZip = [
      projectInfo.city,
      projectInfo.state,
      projectInfo.zip
    ].filter(Boolean).join(", ");
    if (cityStateZip) {
      doc.text(cityStateZip, midColX, midYPos);
      midYPos += 5;
    }
  } else {
    doc.setTextColor(128, 128, 128);
    doc.text("(No address provided)", midColX, midYPos);
    doc.setTextColor(0, 0, 0);
    midYPos += 5;
  }
  
  // Point of Contact (below Ship To in middle column)
  midYPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("CONTACT:", midColX, midYPos);
  doc.setFont("helvetica", "normal");
  midYPos += 5;
  
  let hasContact = false;
  if (projectInfo?.contact_name) {
    doc.text(projectInfo.contact_name, midColX, midYPos);
    midYPos += 4;
    hasContact = true;
  }
  if (projectInfo?.contact_phone) {
    doc.text(`Ph: ${projectInfo.contact_phone}`, midColX, midYPos);
    midYPos += 4;
    hasContact = true;
  }
  if (projectInfo?.contact_email) {
    const emailLines = doc.splitTextToSize(projectInfo.contact_email, 55);
    doc.text(emailLines, midColX, midYPos);
    hasContact = true;
  }
  
  if (!hasContact) {
    doc.setTextColor(128, 128, 128);
    doc.text("(No contact provided)", midColX, midYPos);
    doc.setTextColor(0, 0, 0);
  }
  
  // Adjust yPos to continue after both columns
  yPos = Math.max(leftYPos + 10, midYPos + 10, 105);
  
  // Line Items Table
  yPos += 5;
  
  // Table Header
  doc.setFillColor(249, 250, 251);
  doc.rect(20, yPos, pageWidth - 40, 10, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", 25, yPos + 7);
  doc.text("Qty", pageWidth - 105, yPos + 7, { align: "right" });
  doc.text("Vendor Cost", pageWidth - 60, yPos + 7, { align: "right" });
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
    
    // Wrap description if too long - reduced width for better column spacing
    const maxWidth = pageWidth - 140;
    const lines = doc.splitTextToSize(item.description, maxWidth);
    doc.text(lines, 25, yPos);
    
    // Right-align numeric columns
    doc.text(item.quantity.toString(), pageWidth - 105, yPos, { align: "right" });
    doc.text(formatCurrencyForPDF(Number(item.unit_price)), pageWidth - 60, yPos, { align: "right" });
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
