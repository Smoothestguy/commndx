import jsPDF from "jspdf";
import QRCode from "qrcode";

interface BadgeData {
  id: string;
  photo_url?: string | null;
  personnel_number: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  everify_status?: string | null;
}

interface BadgeTemplate {
  name: string;
  orientation: string;
  background_color?: string | null;
  fields: Array<{
    field_name: string;
    is_enabled: boolean;
  }>;
}

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

export const generateBadgePDF = async (
  personnel: BadgeData,
  template: BadgeTemplate
): Promise<void> => {
  const pdf = new jsPDF({
    orientation: template.orientation === "landscape" ? "l" : "p",
    unit: "in",
    format: [3.375, 2.125], // CR80 standard badge size
  });

  // Set background color
  if (template.background_color) {
    pdf.setFillColor(template.background_color);
    pdf.rect(0, 0, 3.375, 2.125, "F");
  } else {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 3.375, 2.125, "F");
  }

  const enabledFields = template.fields.filter((f) => f.is_enabled);

  // Generate QR code if enabled
  let qrCodeDataUrl: string | null = null;
  if (enabledFields.some((f) => f.field_name === "qr_code")) {
    try {
      const siteUrl = import.meta.env.VITE_SUPABASE_URL?.replace('/supabase', '') || window.location.origin;
      qrCodeDataUrl = await generateQRCodeDataURL(`${siteUrl}/personnel/${personnel.id}`);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  }

  // Add photo if available - LEFT SIDE
  if (
    enabledFields.some((f) => f.field_name === "photo") &&
    personnel.photo_url
  ) {
    try {
      // Fetch and embed the actual photo
      const response = await fetch(personnel.photo_url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;
            // Add photo on LEFT side (0.2, 0.4) with size (0.9, 0.9) inches
            pdf.addImage(base64data, 'JPEG', 0.2, 0.4, 0.9, 0.9);
            resolve(null);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to add photo:", error);
      // Fallback to placeholder circle
      pdf.setDrawColor(200, 200, 200);
      pdf.setFillColor(240, 240, 240);
      pdf.circle(0.65, 0.85, 0.4, "FD");
    }
  }

  // Text content on RIGHT SIDE starting at x = 1.3
  let yPosition = 0.35;
  const textStartX = 1.3;

  // Add personnel number (top right, small and gray)
  if (enabledFields.some((f) => f.field_name === "personnel_number")) {
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(personnel.personnel_number, textStartX, yPosition);
    yPosition += 0.25;
  }

  // Add name (large and bold)
  if (
    enabledFields.some(
      (f) => f.field_name === "first_name" || f.field_name === "last_name"
    )
  ) {
    pdf.setFontSize(13);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(
      `${personnel.first_name} ${personnel.last_name}`,
      textStartX,
      yPosition
    );
    yPosition += 0.3;
  }

  // Add phone with label
  if (
    enabledFields.some((f) => f.field_name === "phone") &&
    personnel.phone
  ) {
    pdf.setFontSize(8);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Phone: ${personnel.phone}`, textStartX, yPosition);
    yPosition += 0.2;
  }

  // Add email with label (smaller font for email)
  if (
    enabledFields.some((f) => f.field_name === "email") &&
    personnel.email
  ) {
    pdf.setFontSize(7);
    const emailText = personnel.email.length > 25 
      ? personnel.email.substring(0, 25) + "..." 
      : personnel.email;
    pdf.text(`Email: ${emailText}`, textStartX, yPosition);
    yPosition += 0.25;
  }

  // Add E-Verify status badge at bottom left
  if (
    enabledFields.some((f) => f.field_name === "everify_status") &&
    personnel.everify_status === "verified"
  ) {
    yPosition = 1.85; // Position at bottom
    pdf.setFontSize(8);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(0, 120, 0);
    
    // Draw rounded rectangle background
    pdf.setFillColor(220, 255, 220);
    pdf.roundedRect(textStartX - 0.05, yPosition - 0.12, 1.1, 0.18, 0.05, 0.05, "F");
    
    // Add text
    pdf.text("E-VERIFIED", textStartX, yPosition);
  }

  // Add QR code at bottom right
  if (qrCodeDataUrl) {
    const qrSize = 0.6; // 0.6 inches square
    const qrX = 3.375 - qrSize - 0.15; // Right side with margin
    const qrY = 2.125 - qrSize - 0.15; // Bottom with margin
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

  const badgesPerPage = 8; // 2 columns x 4 rows
  const badgeWidth = 3.375;
  const badgeHeight = 2.125;
  const marginX = 0.5;
  const marginY = 0.5;
  const spacingX = 4.0;
  const spacingY = 2.5;

  const enabledFields = template.fields.filter((f) => f.is_enabled);

  for (let i = 0; i < personnelList.length; i++) {
    // Add new page if needed
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
    if (template.background_color) {
      pdf.setFillColor(template.background_color);
      pdf.rect(x, y, badgeWidth, badgeHeight, "F");
    } else {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(x, y, badgeWidth, badgeHeight, "F");
    }

    // Draw badge border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.01);
    pdf.rect(x, y, badgeWidth, badgeHeight);

    // Generate QR code if enabled
    let qrCodeDataUrl: string | null = null;
    if (enabledFields.some((f) => f.field_name === "qr_code")) {
      try {
        const siteUrl = import.meta.env.VITE_SUPABASE_URL?.replace('/supabase', '') || window.location.origin;
        qrCodeDataUrl = await generateQRCodeDataURL(`${siteUrl}/personnel/${personnel.id}`);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
      }
    }

    // Add photo if available - LEFT SIDE
    if (
      enabledFields.some((f) => f.field_name === "photo") &&
      personnel.photo_url
    ) {
      try {
        const response = await fetch(personnel.photo_url);
        const blob = await response.blob();
        const reader = new FileReader();
        
        await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            try {
              const base64data = reader.result as string;
              pdf.addImage(base64data, 'JPEG', x + 0.2, y + 0.4, 0.9, 0.9);
              resolve(null);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Failed to add photo:", error);
        // Fallback to placeholder circle
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(240, 240, 240);
        pdf.circle(x + 0.65, y + 0.85, 0.4, "FD");
      }
    }

    // Text content on RIGHT SIDE
    let yPos = y + 0.35;
    const textX = x + 1.3;

    // Add personnel number
    if (enabledFields.some((f) => f.field_name === "personnel_number")) {
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text(personnel.personnel_number, textX, yPos);
      yPos += 0.25;
    }

    // Add name
    if (
      enabledFields.some(
        (f) => f.field_name === "first_name" || f.field_name === "last_name"
      )
    ) {
      pdf.setFontSize(13);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `${personnel.first_name} ${personnel.last_name}`,
        textX,
        yPos
      );
      yPos += 0.3;
    }

    // Add phone
    if (
      enabledFields.some((f) => f.field_name === "phone") &&
      personnel.phone
    ) {
      pdf.setFontSize(8);
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Phone: ${personnel.phone}`, textX, yPos);
      yPos += 0.2;
    }

    // Add email
    if (
      enabledFields.some((f) => f.field_name === "email") &&
      personnel.email
    ) {
      pdf.setFontSize(7);
      const emailText = personnel.email.length > 25 
        ? personnel.email.substring(0, 25) + "..." 
        : personnel.email;
      pdf.text(`Email: ${emailText}`, textX, yPos);
      yPos += 0.25;
    }

    // Add E-Verify status at bottom left
    if (
      enabledFields.some((f) => f.field_name === "everify_status") &&
      personnel.everify_status === "verified"
    ) {
      const eVerifyY = y + 1.85;
      pdf.setFontSize(8);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(0, 120, 0);
      
      pdf.setFillColor(220, 255, 220);
      pdf.roundedRect(textX - 0.05, eVerifyY - 0.12, 1.1, 0.18, 0.05, 0.05, "F");
      
      pdf.text("E-VERIFIED", textX, eVerifyY);
    }

    // Add QR code at bottom right
    if (qrCodeDataUrl) {
      const qrSize = 0.6;
      const qrX = x + badgeWidth - qrSize - 0.15;
      const qrY = y + badgeHeight - qrSize - 0.15;
      pdf.addImage(qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }
  }

  pdf.save(`badges-bulk-${personnelList.length}-${new Date().getTime()}.pdf`);
};