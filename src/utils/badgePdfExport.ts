import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Json } from "@/integrations/supabase/types";

interface BadgeData {
  id: string;
  photo_url?: string | null;
  personnel_number: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  everify_status?: string | null;
  work_authorization_type?: string | null;
  certifications?: Array<{ certification_name: string; expiry_date?: string | null }> | null;
  capabilities?: Array<{ capability: string }> | null;
  languages?: Array<{ language: string; proficiency?: string | null }> | null;
}

interface BadgeTemplate {
  name: string;
  orientation: string;
  background_color?: string | null;
  header_color?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  // Field visibility (show_* booleans)
  show_photo?: boolean | null;
  show_personnel_number?: boolean | null;
  show_phone?: boolean | null;
  show_email?: boolean | null;
  show_everify_status?: boolean | null;
  show_work_authorization?: boolean | null;
  show_certifications?: boolean | null;
  show_capabilities?: boolean | null;
  show_languages?: boolean | null;
  // Text colors
  name_color?: string | null;
  personnel_number_color?: string | null;
  label_color?: string | null;
  value_color?: string | null;
  footer_color?: string | null;
  // Custom fields - accepts Json from Supabase
  custom_fields?: Json | null;
  // Legacy support for fields array
  fields?: Array<{
    field_name: string;
    is_enabled: boolean;
  }>;
}

// Helper to safely parse custom fields from Json
const parseCustomFields = (customFields: Json | null | undefined): Array<{ label: string; value: string }> => {
  if (!customFields || !Array.isArray(customFields)) return [];
  return customFields.filter((field): field is { label: string; value: string } => 
    typeof field === 'object' && 
    field !== null && 
    'label' in field && 
    'value' in field &&
    typeof (field as any).label === 'string' &&
    typeof (field as any).value === 'string'
  );
};

// Helper function to generate QR code as data URL
const generateQRCodeDataURL = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    throw error;
  }
};

// Helper to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

// Helper to check if a field is enabled (supports both show_* booleans and legacy fields array)
const isFieldEnabled = (fieldName: string, template: BadgeTemplate): boolean => {
  // QR code is always enabled by default
  if (fieldName === "qr_code") return true;
  
  const showFieldMap: Record<string, keyof BadgeTemplate> = {
    photo: "show_photo",
    personnel_number: "show_personnel_number",
    phone: "show_phone",
    email: "show_email",
    everify_status: "show_everify_status",
    work_authorization: "show_work_authorization",
    certifications: "show_certifications",
    capabilities: "show_capabilities",
    languages: "show_languages",
  };

  const showKey = showFieldMap[fieldName];
  if (showKey && template[showKey] !== undefined && template[showKey] !== null) {
    return template[showKey] as boolean;
  }

  // Fallback to fields array (legacy)
  if (template.fields) {
    const field = template.fields.find((f) => f.field_name === fieldName);
    if (field) {
      return field.is_enabled;
    }
  }

  // Default to true for name fields
  if (fieldName === "first_name" || fieldName === "last_name") {
    return true;
  }

  return true;
};

// Helper to truncate text to fit within a max width
const truncateText = (pdf: jsPDF, text: string, maxWidth: number): string => {
  const textWidth = pdf.getTextWidth(text);
  if (textWidth <= maxWidth) return text;
  
  let truncated = text;
  while (pdf.getTextWidth(truncated + "...") > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
};

// Helper to fetch image as base64
const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    // Skip local paths that won't work with fetch
    if (!url || url.startsWith('/') || url.startsWith('./')) {
      console.warn("Skipping local path for image:", url);
      return null;
    }
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch image, status:", response.status);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to fetch image:", error);
    return null;
  }
};

// Helper to format work authorization type for display
const formatWorkAuthType = (type: string | null | undefined): string => {
  if (!type) return "";
  const typeMap: Record<string, string> = {
    us_citizen: "US Citizen",
    citizen: "US Citizen",
    permanent_resident: "Permanent Resident",
    green_card: "Green Card",
    work_visa: "Work Visa",
    h1b: "H-1B Visa",
    ead: "EAD",
    opt: "OPT",
    tn_visa: "TN Visa",
    other: "Other",
  };
  return typeMap[type.toLowerCase()] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

// Helper to draw placeholder with initials
const drawPhotoPlaceholder = (pdf: jsPDF, x: number, y: number, size: number, firstName: string, lastName: string) => {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2 - 0.02;
  
  pdf.setDrawColor(180, 180, 180);
  pdf.setFillColor(230, 230, 230);
  pdf.circle(centerX, centerY, radius, "FD");
  
  // Add initials
  const initials = `${(firstName || "?")[0]}${(lastName || "?")[0]}`.toUpperCase();
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(18);
  pdf.setFont(undefined, "bold");
  pdf.text(initials, centerX, centerY + 0.07, { align: "center" });
};

export const generateBadgePDF = async (
  personnel: BadgeData,
  template: BadgeTemplate
): Promise<void> => {
  const badgeWidth = 3.375;
  const badgeHeight = 2.125;
  const headerHeight = 0.4;

  const pdf = new jsPDF({
    orientation: template.orientation === "landscape" ? "l" : "p",
    unit: "in",
    format: [badgeWidth, badgeHeight],
  });

  // Set background color
  const bgColor = hexToRgb(template.background_color || "#ffffff");
  pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
  pdf.rect(0, 0, badgeWidth, badgeHeight, "F");

  // Draw header bar
  const headerColor = hexToRgb(template.header_color || "#1e40af");
  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(0, 0, badgeWidth, headerHeight, "F");

  // Add company logo to header if available
  let logoEndX = 0.1;
  if (template.company_logo_url) {
    try {
      const logoBase64 = await fetchImageAsBase64(template.company_logo_url);
      if (logoBase64) {
        const logoSize = 0.38;
        pdf.addImage(logoBase64, "PNG", 0.1, 0.01, logoSize, logoSize);
        logoEndX = 0.1 + logoSize + 0.08;
      }
    } catch (error) {
      console.error("Failed to add company logo:", error);
    }
  }

  // Add company name to header
  if (template.company_name) {
    pdf.setFontSize(10);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text(template.company_name, logoEndX, 0.26);
  }

  // Generate QR code if enabled
  let qrCodeDataUrl: string | null = null;
  if (isFieldEnabled("qr_code", template)) {
    try {
      const siteUrl =
        import.meta.env.VITE_SUPABASE_URL?.replace("/supabase", "") ||
        window.location.origin;
      qrCodeDataUrl = await generateQRCodeDataURL(
        `${siteUrl}/personnel/${personnel.id}`
      );
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  }

  // Add photo if available - LEFT SIDE (below header)
  const contentStartY = headerHeight + 0.1;
  const photoSize = 0.85;
  if (isFieldEnabled("photo", template)) {
    let photoAdded = false;
    if (personnel.photo_url) {
      try {
        const photoBase64 = await fetchImageAsBase64(personnel.photo_url);
        if (photoBase64) {
          pdf.addImage(photoBase64, "JPEG", 0.15, contentStartY, photoSize, photoSize);
          photoAdded = true;
        }
      } catch (error) {
        console.error("Failed to add photo:", error);
      }
    }
    // Show placeholder if no photo or failed to load
    if (!photoAdded) {
      drawPhotoPlaceholder(pdf, 0.15, contentStartY, photoSize, personnel.first_name, personnel.last_name);
    }
  }

  // Text content on RIGHT SIDE
  let yPosition = contentStartY + 0.1;
  const textStartX = 1.15;

  // Get colors from template
  const nameColor = hexToRgb(template.name_color || "#000000");
  const personnelNumberColor = hexToRgb(template.personnel_number_color || "#ea580c");
  const labelColor = hexToRgb(template.label_color || "#374151");
  const valueColor = hexToRgb(template.value_color || "#1f2937");
  const footerColor = hexToRgb(template.footer_color || "#6b7280");

  // Add personnel number
  if (isFieldEnabled("personnel_number", template)) {
    pdf.setFontSize(10);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(personnelNumberColor.r, personnelNumberColor.g, personnelNumberColor.b);
    pdf.text(personnel.personnel_number, textStartX, yPosition);
    yPosition += 0.22;
  }

  // Add name with truncation
  if (isFieldEnabled("first_name", template) || isFieldEnabled("last_name", template)) {
    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(nameColor.r, nameColor.g, nameColor.b);
    const fullName = `${personnel.first_name} ${personnel.last_name}`;
    const maxNameWidth = 2.0; // Max width in inches for name
    const displayName = truncateText(pdf, fullName, maxNameWidth);
    pdf.text(displayName, textStartX, yPosition);
    yPosition += 0.22;
  }

  // Add work authorization with dynamic spacing
  if (isFieldEnabled("work_authorization", template) && personnel.work_authorization_type) {
    pdf.setFontSize(7);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    const workAuthLabel = "Work Auth: ";
    pdf.text(workAuthLabel, textStartX, yPosition);
    const labelWidth = pdf.getTextWidth(workAuthLabel);
    
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    pdf.text(formatWorkAuthType(personnel.work_authorization_type), textStartX + labelWidth, yPosition);
    yPosition += 0.14;
  }

  // Add phone with label
  if (isFieldEnabled("phone", template) && personnel.phone) {
    pdf.setFontSize(7);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.text("Phone: ", textStartX, yPosition);
    
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    pdf.text(personnel.phone, textStartX + 0.35, yPosition);
    yPosition += 0.14;
  }

  // Add email with label
  if (isFieldEnabled("email", template) && personnel.email) {
    pdf.setFontSize(6);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.text("Email: ", textStartX, yPosition);
    
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    const emailText =
      personnel.email.length > 20
        ? personnel.email.substring(0, 20) + "..."
        : personnel.email;
    pdf.text(emailText, textStartX + 0.28, yPosition);
    yPosition += 0.14;
  }

  // Add certifications (compact list)
  if (isFieldEnabled("certifications", template) && personnel.certifications && personnel.certifications.length > 0) {
    pdf.setFontSize(6);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.text("Certs: ", textStartX, yPosition);
    
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    const certNames = personnel.certifications.slice(0, 2).map(c => c.certification_name).join(", ");
    const certText = certNames.length > 25 ? certNames.substring(0, 25) + "..." : certNames;
    pdf.text(certText, textStartX + 0.25, yPosition);
    yPosition += 0.12;
  }

  // Add capabilities (compact list)
  if (isFieldEnabled("capabilities", template) && personnel.capabilities && personnel.capabilities.length > 0) {
    pdf.setFontSize(6);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.text("Skills: ", textStartX, yPosition);
    
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    const capNames = personnel.capabilities.slice(0, 3).map(c => c.capability).join(", ");
    const capText = capNames.length > 25 ? capNames.substring(0, 25) + "..." : capNames;
    pdf.text(capText, textStartX + 0.25, yPosition);
    yPosition += 0.12;
  }

  // Add languages (compact list)
  if (isFieldEnabled("languages", template) && personnel.languages && personnel.languages.length > 0) {
    pdf.setFontSize(6);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.text("Lang: ", textStartX, yPosition);
    
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    const langNames = personnel.languages.slice(0, 3).map(l => l.language).join(", ");
    const langText = langNames.length > 25 ? langNames.substring(0, 25) + "..." : langNames;
    pdf.text(langText, textStartX + 0.25, yPosition);
    yPosition += 0.12;
  }

  // Add custom fields
  const parsedCustomFields = parseCustomFields(template.custom_fields);
  if (parsedCustomFields.length > 0) {
    parsedCustomFields.forEach((field) => {
      if (yPosition < badgeHeight - 0.4) {
        pdf.setFontSize(6);
        pdf.setFont(undefined, "bold");
        pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
        pdf.text(`${field.label}: `, textStartX, yPosition);
        
        pdf.setFont(undefined, "normal");
        pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
        const valueText = field.value.length > 20 ? field.value.substring(0, 20) + "..." : field.value;
        pdf.text(valueText, textStartX + 0.4, yPosition);
        yPosition += 0.12;
      }
    });
  }

  // Add E-Verify status badge at bottom
  if (
    isFieldEnabled("everify_status", template) &&
    personnel.everify_status === "verified"
  ) {
    const eVerifyY = badgeHeight - 0.25;
    pdf.setFontSize(8);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(0, 120, 0);

    // Draw rounded rectangle background
    pdf.setFillColor(220, 255, 220);
    pdf.roundedRect(textStartX - 0.05, eVerifyY - 0.12, 1.0, 0.18, 0.05, 0.05, "F");

    pdf.text("E-VERIFIED", textStartX, eVerifyY);
  }

  // Add footer text
  pdf.setFontSize(6);
  pdf.setTextColor(footerColor.r, footerColor.g, footerColor.b);

  // Add QR code at bottom right
  if (qrCodeDataUrl) {
    const qrSize = 0.55;
    const qrX = badgeWidth - qrSize - 0.1;
    const qrY = badgeHeight - qrSize - 0.1;
    pdf.addImage(qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  }

  // Save the PDF
  pdf.save(
    `badge-${personnel.personnel_number}-${personnel.first_name}-${personnel.last_name}.pdf`
  );
};

export const generateBulkBadgePDF = async (
  personnelList: BadgeData[],
  template: BadgeTemplate
): Promise<void> => {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const badgesPerPage = 8;
  const badgeWidth = 3.375;
  const badgeHeight = 2.125;
  const headerHeight = 0.4;
  const marginX = 0.5;
  const marginY = 0.5;
  const spacingX = 4.0;
  const spacingY = 2.5;

  // Get colors from template
  const bgColor = hexToRgb(template.background_color || "#ffffff");
  const headerColor = hexToRgb(template.header_color || "#1e40af");
  const nameColor = hexToRgb(template.name_color || "#000000");
  const personnelNumberColor = hexToRgb(template.personnel_number_color || "#ea580c");
  const labelColor = hexToRgb(template.label_color || "#374151");
  const valueColor = hexToRgb(template.value_color || "#1f2937");

  // Pre-fetch company logo if available
  let logoBase64: string | null = null;
  if (template.company_logo_url) {
    logoBase64 = await fetchImageAsBase64(template.company_logo_url);
  }

  for (let i = 0; i < personnelList.length; i++) {
    if (i > 0 && i % badgesPerPage === 0) {
      pdf.addPage();
    }

    const badgeIndex = i % badgesPerPage;
    const row = Math.floor(badgeIndex / 2);
    const col = badgeIndex % 2;

    const x = marginX + col * spacingX;
    const y = marginY + row * spacingY;

    const personnel = personnelList[i];

    // Set background color
    pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
    pdf.rect(x, y, badgeWidth, badgeHeight, "F");

    // Draw badge border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.01);
    pdf.rect(x, y, badgeWidth, badgeHeight);

    // Draw header bar
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.rect(x, y, badgeWidth, headerHeight, "F");

    // Add company logo to header
    let logoEndX = x + 0.1;
    if (logoBase64) {
      try {
        const logoSize = 0.38;
        pdf.addImage(logoBase64, "PNG", x + 0.1, y + 0.01, logoSize, logoSize);
        logoEndX = x + 0.1 + logoSize + 0.08;
      } catch (error) {
        console.error("Failed to add company logo:", error);
      }
    }

    // Add company name to header
    if (template.company_name) {
      pdf.setFontSize(10);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(template.company_name, logoEndX, y + 0.26);
    }

    // Generate QR code if enabled
    let qrCodeDataUrl: string | null = null;
    if (isFieldEnabled("qr_code", template)) {
      try {
        const siteUrl =
          import.meta.env.VITE_SUPABASE_URL?.replace("/supabase", "") ||
          window.location.origin;
        qrCodeDataUrl = await generateQRCodeDataURL(
          `${siteUrl}/personnel/${personnel.id}`
        );
      } catch (error) {
        console.error("Failed to generate QR code:", error);
      }
    }

    // Add photo if available - LEFT SIDE (below header)
    const contentStartY = y + headerHeight + 0.1;
    const photoSize = 0.85;
    if (isFieldEnabled("photo", template)) {
      let photoAdded = false;
      if (personnel.photo_url) {
        try {
          const photoBase64 = await fetchImageAsBase64(personnel.photo_url);
          if (photoBase64) {
            pdf.addImage(photoBase64, "JPEG", x + 0.15, contentStartY, photoSize, photoSize);
            photoAdded = true;
          }
        } catch (error) {
          console.error("Failed to add photo:", error);
        }
      }
      // Show placeholder if no photo or failed to load
      if (!photoAdded) {
        drawPhotoPlaceholder(pdf, x + 0.15, contentStartY, photoSize, personnel.first_name, personnel.last_name);
      }
    }

    // Text content on RIGHT SIDE
    let yPos = contentStartY + 0.1;
    const textX = x + 1.15;

    // Add personnel number
    if (isFieldEnabled("personnel_number", template)) {
      pdf.setFontSize(10);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(personnelNumberColor.r, personnelNumberColor.g, personnelNumberColor.b);
      pdf.text(personnel.personnel_number, textX, yPos);
      yPos += 0.22;
    }

    // Add name with truncation
    if (isFieldEnabled("first_name", template) || isFieldEnabled("last_name", template)) {
      pdf.setFontSize(14);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(nameColor.r, nameColor.g, nameColor.b);
      const fullName = `${personnel.first_name} ${personnel.last_name}`;
      const maxNameWidth = 2.0;
      const displayName = truncateText(pdf, fullName, maxNameWidth);
      pdf.text(displayName, textX, yPos);
      yPos += 0.22;
    }

    // Add work authorization with dynamic spacing
    if (isFieldEnabled("work_authorization", template) && personnel.work_authorization_type) {
      pdf.setFontSize(7);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      const workAuthLabel = "Work Auth: ";
      pdf.text(workAuthLabel, textX, yPos);
      const labelWidth = pdf.getTextWidth(workAuthLabel);
      
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      pdf.text(formatWorkAuthType(personnel.work_authorization_type), textX + labelWidth, yPos);
      yPos += 0.14;
    }

    // Add phone
    if (isFieldEnabled("phone", template) && personnel.phone) {
      pdf.setFontSize(7);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      pdf.text("Phone: ", textX, yPos);
      
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      pdf.text(personnel.phone, textX + 0.35, yPos);
      yPos += 0.14;
    }

    // Add email
    if (isFieldEnabled("email", template) && personnel.email) {
      pdf.setFontSize(6);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      pdf.text("Email: ", textX, yPos);
      
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      const emailText =
        personnel.email.length > 20
          ? personnel.email.substring(0, 20) + "..."
          : personnel.email;
      pdf.text(emailText, textX + 0.28, yPos);
      yPos += 0.14;
    }

    // Add certifications
    if (isFieldEnabled("certifications", template) && personnel.certifications && personnel.certifications.length > 0) {
      pdf.setFontSize(6);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      pdf.text("Certs: ", textX, yPos);
      
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      const certNames = personnel.certifications.slice(0, 2).map(c => c.certification_name).join(", ");
      const certText = certNames.length > 25 ? certNames.substring(0, 25) + "..." : certNames;
      pdf.text(certText, textX + 0.25, yPos);
      yPos += 0.12;
    }

    // Add capabilities
    if (isFieldEnabled("capabilities", template) && personnel.capabilities && personnel.capabilities.length > 0) {
      pdf.setFontSize(6);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      pdf.text("Skills: ", textX, yPos);
      
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      const capNames = personnel.capabilities.slice(0, 3).map(c => c.capability).join(", ");
      const capText = capNames.length > 25 ? capNames.substring(0, 25) + "..." : capNames;
      pdf.text(capText, textX + 0.25, yPos);
      yPos += 0.12;
    }

    // Add languages
    if (isFieldEnabled("languages", template) && personnel.languages && personnel.languages.length > 0) {
      pdf.setFontSize(6);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      pdf.text("Lang: ", textX, yPos);
      
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      const langNames = personnel.languages.slice(0, 3).map(l => l.language).join(", ");
      const langText = langNames.length > 25 ? langNames.substring(0, 25) + "..." : langNames;
      pdf.text(langText, textX + 0.25, yPos);
      yPos += 0.12;
    }

    // Add custom fields
    const parsedCustomFields = parseCustomFields(template.custom_fields);
    if (parsedCustomFields.length > 0) {
      parsedCustomFields.forEach((field) => {
        if (yPos < y + badgeHeight - 0.4) {
          pdf.setFontSize(6);
          pdf.setFont(undefined, "bold");
          pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
          pdf.text(`${field.label}: `, textX, yPos);
          
          pdf.setFont(undefined, "normal");
          pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
          const valueText = field.value.length > 20 ? field.value.substring(0, 20) + "..." : field.value;
          pdf.text(valueText, textX + 0.4, yPos);
          yPos += 0.12;
        }
      });
    }

    // Add E-Verify status at bottom
    if (
      isFieldEnabled("everify_status", template) &&
      personnel.everify_status === "verified"
    ) {
      const eVerifyY = y + badgeHeight - 0.25;
      pdf.setFontSize(8);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(0, 120, 0);

      pdf.setFillColor(220, 255, 220);
      pdf.roundedRect(textX - 0.05, eVerifyY - 0.12, 1.0, 0.18, 0.05, 0.05, "F");

      pdf.text("E-VERIFIED", textX, eVerifyY);
    }

    // Add QR code at bottom right
    if (qrCodeDataUrl) {
      const qrSize = 0.55;
      const qrX = x + badgeWidth - qrSize - 0.1;
      const qrY = y + badgeHeight - qrSize - 0.1;
      pdf.addImage(qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }
  }

  pdf.save(`badges-bulk-${personnelList.length}-${new Date().getTime()}.pdf`);
};
