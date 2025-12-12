import jsPDF from "jspdf";

// ==================== CONSTANTS ====================
export const PDF_COLORS = {
  primary: { r: 37, g: 99, b: 235 },        // #2563EB - Blue
  primaryLight: { r: 239, g: 246, b: 255 }, // #EFF6FF - Light blue bg
  success: { r: 34, g: 197, b: 94 },        // #22C55E - Green
  warning: { r: 234, g: 179, b: 8 },        // #EAB308 - Yellow
  gray50: { r: 249, g: 250, b: 251 },       // #F9FAFB - Table header bg
  gray400: { r: 156, g: 163, b: 175 },      // #9CA3AF - Muted text
  gray500: { r: 107, g: 114, b: 128 },      // #6B7280 - Footer text
  gray600: { r: 75, g: 85, b: 99 },         // #4B5563 - Secondary text
  gray200: { r: 229, g: 231, b: 235 },      // #E5E7EB - Lines
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
};

export const PDF_FONTS = {
  title: 18,
  subtitle: 16,
  heading: 12,
  subheading: 11,
  body: 10,
  small: 9,
  xsmall: 8,
};

export const PDF_MARGIN = 20;

// ==================== INTERFACES ====================
export interface CompanyInfo {
  company_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

export interface AddressInfo {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
}

// ==================== UTILITY FUNCTIONS ====================
export const formatCurrencyForPDF = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const setColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setTextColor(color.r, color.g, color.b);
};

export const setFillColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setFillColor(color.r, color.g, color.b);
};

export const setDrawColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setDrawColor(color.r, color.g, color.b);
};

// ==================== HEADER FUNCTIONS ====================
export const loadCompanyLogo = async (): Promise<string | null> => {
  try {
    const logoUrl = "/images/company-logo.png";
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return base64;
  } catch (error) {
    console.error("Failed to load logo:", error);
    return null;
  }
};

export const drawDocumentHeader = async (
  doc: jsPDF,
  documentType: string,
  company: CompanyInfo,
  yPos: number = 20
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerRightX = pageWidth - PDF_MARGIN;
  let logoHeight = 12;

  // Load and add company logo (top-right)
  const logoBase64 = await loadCompanyLogo();
  if (logoBase64) {
    const logoWidth = 45;
    const logoX = pageWidth - PDF_MARGIN - logoWidth;
    doc.addImage(logoBase64, "PNG", logoX, yPos - 5, logoWidth, logoHeight);
  }

  // Document type title - blue, top-left
  setColor(doc, PDF_COLORS.primary);
  doc.setFontSize(PDF_FONTS.title);
  doc.setFont("helvetica", "bold");
  doc.text(documentType.toUpperCase(), PDF_MARGIN, yPos);

  // Right column - contact info stacked and right-aligned under logo
  let contactYPos = yPos + logoHeight + 3;
  setColor(doc, PDF_COLORS.gray600);
  doc.setFontSize(PDF_FONTS.small);
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
  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(PDF_FONTS.subheading);
  doc.setFont("helvetica", "bold");
  doc.text(company.company_name || "Fairfield Group", PDF_MARGIN, yPos);

  yPos += 5;

  // Address line (left column)
  setColor(doc, PDF_COLORS.gray600);
  doc.setFontSize(PDF_FONTS.body);
  doc.setFont("helvetica", "normal");
  if (company.address) {
    doc.text(company.address, PDF_MARGIN, yPos);
    yPos += 5;
  }

  // City, State ZIP (left column)
  if (company.city || company.state || company.zip) {
    const cityStateZip = [company.city, company.state, company.zip].filter(Boolean).join(", ");
    doc.text(cityStateZip, PDF_MARGIN, yPos);
  }

  return yPos + 10;
};

// ==================== ADDRESS BOX FUNCTIONS ====================
export const drawAddressBox = (
  doc: jsPDF,
  label: string,
  address: AddressInfo,
  x: number,
  y: number,
  width: number,
  includeContact: boolean = false
): number => {
  let currentY = y;

  // Label
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);
  doc.text(label, x, currentY);
  currentY += 6;

  // Name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  doc.text(address.name || "", x, currentY);
  currentY += 4;

  // Address
  if (address.address) {
    setColor(doc, PDF_COLORS.gray600);
    const addressLines = doc.splitTextToSize(address.address, width - 10);
    addressLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, x, currentY);
      currentY += 4;
    });
  }

  // City, State ZIP
  if (address.city || address.state || address.zip) {
    const cityStateZip = [address.city, address.state, address.zip].filter(Boolean).join(", ");
    doc.text(cityStateZip, x, currentY);
    currentY += 4;
  }

  // Contact info
  if (includeContact) {
    if (address.phone) {
      doc.text(address.phone, x, currentY);
      currentY += 4;
    }
    if (address.email) {
      doc.text(address.email, x, currentY);
      currentY += 4;
    }
  }

  return currentY;
};

export const drawDualAddressSection = (
  doc: jsPDF,
  billTo: AddressInfo,
  shipTo: AddressInfo | null,
  yPos: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const halfWidth = (pageWidth - 2 * PDF_MARGIN) / 2;
  const hasBothAddresses = !!shipTo;
  const boxHeight = hasBothAddresses ? 45 : 40;

  // Light blue background
  setFillColor(doc, PDF_COLORS.primaryLight);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, boxHeight, "F");

  // Bill To (left column)
  const leftEndY = drawAddressBox(doc, "Bill to", billTo, PDF_MARGIN + 5, yPos + 8, halfWidth, true);

  // Ship To (right column)
  if (shipTo) {
    drawAddressBox(doc, "Ship to / Jobsite", shipTo, PDF_MARGIN + halfWidth + 5, yPos + 8, halfWidth, false);
  }

  return yPos + boxHeight + 5;
};

// ==================== TABLE FUNCTIONS ====================
export const drawTableHeader = (
  doc: jsPDF,
  columns: { label: string; x: number; align?: "left" | "right" }[],
  yPos: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Gray background
  setFillColor(doc, PDF_COLORS.gray50);
  doc.rect(PDF_MARGIN, yPos, pageWidth - 2 * PDF_MARGIN, 10, "F");

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.body);

  columns.forEach((col) => {
    if (col.align === "right") {
      doc.text(col.label, col.x, yPos + 7, { align: "right" });
    } else {
      doc.text(col.label, col.x, yPos + 7);
    }
  });

  return yPos + 10;
};

export const drawSeparatorLine = (doc: jsPDF, yPos: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  setDrawColor(doc, PDF_COLORS.gray200);
  doc.line(PDF_MARGIN, yPos, pageWidth - PDF_MARGIN, yPos);
  return yPos + 5;
};

export const drawDashedLine = (doc: jsPDF, yPos: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  setDrawColor(doc, { r: 200, g: 200, b: 200 });
  doc.setLineDashPattern([2, 2], 0);
  doc.line(PDF_MARGIN, yPos, pageWidth - PDF_MARGIN, yPos);
  doc.setLineDashPattern([], 0);
  return yPos + 8;
};

// ==================== TOTALS SECTION ====================
export const drawTotalsSection = (
  doc: jsPDF,
  totals: { label: string; value: number; bold?: boolean; highlight?: boolean }[],
  yPos: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalsX = pageWidth - 70;

  totals.forEach((item) => {
    if (item.bold) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(PDF_FONTS.heading);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(PDF_FONTS.body);
    }

    if (item.highlight) {
      setColor(doc, PDF_COLORS.primary);
    } else {
      setColor(doc, PDF_COLORS.black);
    }

    doc.text(item.label, totalsX, yPos);
    doc.text(formatCurrencyForPDF(item.value), pageWidth - PDF_MARGIN - 5, yPos, { align: "right" });
    yPos += item.bold ? 10 : 7;
  });

  setColor(doc, PDF_COLORS.black);
  return yPos;
};

// ==================== NOTES & FOOTER FUNCTIONS ====================
export const drawNotesSection = (
  doc: jsPDF,
  title: string,
  notes: string,
  yPos: number,
  checkPageBreak: (space: number) => boolean
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();

  checkPageBreak(30);
  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(PDF_FONTS.body);
  doc.setFont("helvetica", "bold");
  doc.text(title, PDF_MARGIN, yPos);
  yPos += 6;

  doc.setFont("helvetica", "normal");
  const noteLines = doc.splitTextToSize(notes, pageWidth - 2 * PDF_MARGIN);
  noteLines.forEach((line: string) => {
    checkPageBreak(6);
    doc.text(line, PDF_MARGIN, yPos);
    yPos += 5;
  });

  return yPos;
};

export const drawInstructionsBox = (
  doc: jsPDF,
  title: string,
  content: string,
  yPos: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - 2 * PDF_MARGIN;
  
  // Calculate required height
  const contentLines = doc.splitTextToSize(content, boxWidth - 10);
  const boxHeight = Math.max(20, 12 + contentLines.length * 5);

  // Gray background box
  setFillColor(doc, PDF_COLORS.gray50);
  doc.rect(PDF_MARGIN, yPos, boxWidth, boxHeight, "F");

  // Title
  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.small);
  doc.text(title, PDF_MARGIN + 5, yPos + 7);

  // Content
  doc.setFont("helvetica", "normal");
  let contentY = yPos + 14;
  contentLines.forEach((line: string) => {
    doc.text(line, PDF_MARGIN + 5, contentY);
    contentY += 5;
  });

  return yPos + boxHeight + 5;
};

export const drawSignatureLines = (doc: jsPDF, labels: string[], yPos: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const lineWidth = 80;
  const dateWidth = 50;

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);

  labels.forEach((label) => {
    doc.text(`${label}:`, PDF_MARGIN, yPos);
    
    // Signature line
    setDrawColor(doc, PDF_COLORS.black);
    doc.line(PDF_MARGIN + 40, yPos, PDF_MARGIN + 40 + lineWidth, yPos);
    
    // Date line
    doc.text("Date:", PDF_MARGIN + 45 + lineWidth, yPos);
    doc.line(PDF_MARGIN + 60 + lineWidth, yPos, PDF_MARGIN + 60 + lineWidth + dateWidth, yPos);
    
    yPos += 12;
  });

  return yPos;
};

export const drawFooter = (doc: jsPDF, companyName: string = "Fairfield Group", customMessage?: string): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const footerY = doc.internal.pageSize.getHeight() - 20;

  setColor(doc, PDF_COLORS.gray500);
  doc.setFontSize(PDF_FONTS.small);
  doc.setFont("helvetica", "normal");

  const footerText = `${companyName} - https://fairfieldgp.com/`;
  doc.text(footerText, pageWidth / 2, footerY, { align: "center" });

  if (customMessage) {
    doc.text(customMessage, pageWidth / 2, footerY + 5, { align: "center" });
  }
};

// ==================== PAGE BREAK HELPER ====================
export const createPageBreakChecker = (doc: jsPDF, bottomMargin: number = 40) => {
  let yPos = 0;
  
  return {
    setYPos: (y: number) => { yPos = y; },
    getYPos: () => yPos,
    check: (requiredSpace: number): boolean => {
      if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - bottomMargin) {
        doc.addPage();
        yPos = PDF_MARGIN;
        return true;
      }
      return false;
    }
  };
};

// ==================== DEFAULT COMPANY INFO ====================
export const getDefaultCompanyInfo = (): CompanyInfo => ({
  company_name: "Fairfield Group",
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  email: null,
  website: "https://fairfieldgp.com/",
  logo_url: null,
});
