import { jsPDF } from 'jspdf';
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";

export interface GenerateW9Options {
  w9Form: W9Form;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

// Map database tax classification to internal format
const mapTaxClassification = (dbClassification: string): 'individual' | 'c_corp' | 's_corp' | 'partnership' | 'trust' | 'llc' | 'other' => {
  const map: Record<string, 'individual' | 'c_corp' | 's_corp' | 'partnership' | 'trust' | 'llc' | 'other'> = {
    'individual': 'individual',
    'c_corporation': 'c_corp',
    's_corporation': 's_corp',
    'partnership': 'partnership',
    'trust_estate': 'trust',
    'llc': 'llc',
    'other': 'other',
  };
  return map[dbClassification] || 'other';
};

// Helper to mask SSN
const maskSSN = (ssnLastFour: string | null, ssnFull: string | null): string => {
  if (ssnFull && ssnFull.length === 9) {
    return `${ssnFull.substring(0, 3)}-${ssnFull.substring(3, 5)}-${ssnFull.substring(5, 9)}`;
  }
  if (ssnLastFour) {
    return `***-**-${ssnLastFour}`;
  }
  return '';
};

// Helper to format EIN
const formatEIN = (ein: string | null | undefined): string => {
  if (!ein) return '';
  const digits = ein.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.substring(0, 2)}-${digits.substring(2, 9)}`;
  }
  return ein;
};

export function generateW9(options: GenerateW9Options): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const { w9Form, ssnLastFour, ssnFull } = options;
  
  // Map database fields to display values
  const taxClassification = mapTaxClassification(w9Form.federal_tax_classification);
  const llcClassification = w9Form.llc_tax_classification as 'c' | 's' | 'p' | null;
  const cityStateZip = `${w9Form.city}, ${w9Form.state} ${w9Form.zip}`;
  const signature = w9Form.signature_data;
  const signatureDate = w9Form.signature_date ? new Date(w9Form.signature_date).toLocaleDateString() : null;
  const ein = w9Form.ein;
  
  const pageWidth = 612;
  const margin = 36;
  const contentWidth = pageWidth - (margin * 2);

  // ============================================================================
  // HEADER SECTION
  // ============================================================================
  
  // Top border
  doc.setLineWidth(2);
  doc.line(margin, 40, pageWidth - margin, 40);

  // Form number and title - left side
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Form W-9', margin + 5, 60);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(Rev. March 2024)', margin + 5, 72);
  
  // Main title - center area
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Request for Taxpayer', 180, 52);
  doc.text('Identification Number and Certification', 180, 64);

  // Department info - right side
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Department of the Treasury', pageWidth - margin - 150, 52);
  doc.text('Internal Revenue Service', pageWidth - margin - 150, 64);

  // Website instruction
  doc.setFontSize(7);
  doc.text('Go to www.irs.gov/FormW9 for instructions and the latest information.', margin + 5, 85);

  // Right side instruction box
  doc.setLineWidth(0.5);
  doc.rect(pageWidth - margin - 100, 42, 100, 45);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Give form to the', pageWidth - margin - 95, 52);
  doc.text('requester. Do not', pageWidth - margin - 95, 62);
  doc.text('send to the IRS.', pageWidth - margin - 95, 72);

  // Before you begin instruction
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Before you begin.', margin + 5, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('For guidance related to the purpose of Form W-9, see Purpose of Form, below.', margin + 80, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('Print or type.', margin + 5, 110);
  doc.setFont('helvetica', 'normal');
  doc.text('See Specific Instructions on page 3.', margin + 60, 110);

  // ============================================================================
  // LINE 1: NAME
  // ============================================================================
  
  let currentY = 130;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('1', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('Name of entity/individual. An entry is required.', margin + 10, currentY);

  // Line 1 input box
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY + 10, contentWidth, 20);
  if (w9Form.name_on_return) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(w9Form.name_on_return, margin + 5, currentY + 23);
  }

  // ============================================================================
  // LINE 2: BUSINESS NAME
  // ============================================================================
  
  currentY += 40;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('2', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('Business name/disregarded entity name, if different from above.', margin + 10, currentY);

  // Line 2 input box
  doc.rect(margin, currentY + 5, contentWidth, 20);
  if (w9Form.business_name) {
    doc.setFontSize(10);
    doc.text(w9Form.business_name, margin + 5, currentY + 18);
  }

  // ============================================================================
  // LINE 3A: TAX CLASSIFICATION
  // ============================================================================
  
  currentY += 35;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('3a', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1.', margin + 15, currentY);

  const checkboxY = currentY + 15;
  const checkboxSize = 10;

  // Helper function to draw checkbox with label
  const drawCheckbox = (x: number, y: number, label: string, isChecked: boolean) => {
    doc.rect(x, y, checkboxSize, checkboxSize);
    if (isChecked) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('X', x + 2, y + 8);
      doc.setFontSize(7);
    }
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + checkboxSize + 3, y + 7);
  };

  // First row of checkboxes
  drawCheckbox(margin + 15, checkboxY, 'Individual/sole proprietor', taxClassification === 'individual');
  drawCheckbox(margin + 150, checkboxY, 'C corporation', taxClassification === 'c_corp');
  drawCheckbox(margin + 250, checkboxY, 'S corporation', taxClassification === 's_corp');
  drawCheckbox(margin + 350, checkboxY, 'Partnership', taxClassification === 'partnership');

  // Second row of checkboxes
  const checkbox2Y = checkboxY + 15;
  drawCheckbox(margin + 15, checkbox2Y, 'Trust/estate', taxClassification === 'trust');
  drawCheckbox(margin + 100, checkbox2Y, 'LLC (tax classification: C=C corp, S=S corp, P=Partnership)', taxClassification === 'llc');
  
  // LLC classification box
  if (taxClassification === 'llc' && llcClassification) {
    doc.rect(margin + 400, checkbox2Y, 15, checkboxSize);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(llcClassification.toUpperCase(), margin + 404, checkbox2Y + 8);
  }

  // Other checkbox
  const otherY = checkbox2Y + 15;
  drawCheckbox(margin + 15, otherY, 'Other (see instructions)', taxClassification === 'other');

  // ============================================================================
  // LINE 4: EXEMPTIONS
  // ============================================================================
  
  currentY = otherY + 30;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('4', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('Exemptions (codes apply only to certain entities, not individuals):', margin + 10, currentY);

  // Exemption boxes
  const exemptX = margin + 10;
  doc.text('Exempt payee code (if any):', exemptX, currentY + 12);
  doc.rect(exemptX + 100, currentY + 5, 40, 15);
  if (w9Form.exempt_payee_code) {
    doc.setFontSize(10);
    doc.text(w9Form.exempt_payee_code, exemptX + 105, currentY + 15);
  }

  doc.setFontSize(7);
  doc.text('FATCA exemption code (if any):', exemptX + 200, currentY + 12);
  doc.rect(exemptX + 310, currentY + 5, 40, 15);
  if (w9Form.fatca_exemption_code) {
    doc.setFontSize(10);
    doc.text(w9Form.fatca_exemption_code, exemptX + 315, currentY + 15);
  }

  // ============================================================================
  // LINE 5: ADDRESS
  // ============================================================================
  
  currentY += 35;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('5', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('Address (number, street, and apt. or suite no.). See instructions.', margin + 10, currentY);

  // Address box
  doc.rect(margin, currentY + 5, contentWidth * 0.6, 20);
  if (w9Form.address) {
    doc.setFontSize(10);
    doc.text(w9Form.address, margin + 5, currentY + 18);
  }

  // ============================================================================
  // LINE 6: CITY, STATE, ZIP
  // ============================================================================
  
  currentY += 35;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('6', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('City, state, and ZIP code', margin + 10, currentY);
  doc.rect(margin, currentY + 5, contentWidth, 20);
  if (cityStateZip) {
    doc.setFontSize(10);
    doc.text(cityStateZip, margin + 5, currentY + 18);
  }

  // ============================================================================
  // LINE 7: ACCOUNT NUMBERS
  // ============================================================================
  
  currentY += 35;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('7', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('List account number(s) here (optional)', margin + 10, currentY);
  doc.rect(margin, currentY + 5, contentWidth, 20);
  if (w9Form.account_numbers) {
    doc.setFontSize(10);
    doc.text(w9Form.account_numbers, margin + 5, currentY + 18);
  }

  // ============================================================================
  // PART I: TAXPAYER IDENTIFICATION NUMBER (TIN)
  // ============================================================================
  
  currentY += 40;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Part I', margin, currentY);
  doc.text('Taxpayer Identification Number (TIN)', margin + 40, currentY);
  currentY += 5;
  doc.setLineWidth(1);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 15;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding.', margin, currentY);

  // TIN Display
  currentY += 20;
  const boxWidth = 18;
  const boxHeight = 22;
  
  const useEIN = ein && (taxClassification !== 'individual');
  const ssnY = currentY;

  // SSN Section
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Social security number', margin, currentY - 5);
  
  const ssnFormatted = maskSSN(ssnLastFour || null, ssnFull || null);
  const ssnDigits = ssnFormatted.replace(/-/g, '').split('');
  
  // Draw SSN boxes
  for (let i = 0; i < 3; i++) {
    doc.rect(margin + (i * boxWidth), ssnY, boxWidth, boxHeight);
    if (ssnDigits[i] && ssnDigits[i] !== '*') {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(ssnDigits[i], margin + (i * boxWidth) + 6, ssnY + 15);
    } else if (ssnDigits[i] === '*') {
      doc.text('*', margin + (i * boxWidth) + 6, ssnY + 15);
    }
  }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('—', margin + (3 * boxWidth) + 2, ssnY + 15);
  
  for (let i = 3; i < 5; i++) {
    doc.rect(margin + ((i - 3) * boxWidth) + 70, ssnY, boxWidth, boxHeight);
    if (ssnDigits[i] && ssnDigits[i] !== '*') {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(ssnDigits[i], margin + ((i - 3) * boxWidth) + 70 + 6, ssnY + 15);
    } else if (ssnDigits[i] === '*') {
      doc.text('*', margin + ((i - 3) * boxWidth) + 70 + 6, ssnY + 15);
    }
  }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('—', margin + 112, ssnY + 15);
  
  for (let i = 5; i < 9; i++) {
    doc.rect(margin + ((i - 5) * boxWidth) + 125, ssnY, boxWidth, boxHeight);
    if (ssnDigits[i]) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(ssnDigits[i], margin + ((i - 5) * boxWidth) + 125 + 6, ssnY + 15);
    }
  }

  // EIN Section
  const einX = margin + 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('or', margin + 220, ssnY + 12);
  doc.text('Employer identification number', einX, ssnY - 5);

  if (useEIN) {
    const formattedEIN = formatEIN(ein);
    const einDigits = formattedEIN.replace(/-/g, '').split('');
    
    for (let i = 0; i < 2; i++) {
      doc.rect(einX + (i * boxWidth), ssnY, boxWidth, boxHeight);
      if (einDigits[i]) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(einDigits[i], einX + (i * boxWidth) + 6, ssnY + 15);
      }
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('—', einX + 40, ssnY + 15);
    
    for (let i = 2; i < 9; i++) {
      doc.rect(einX + ((i - 2) * boxWidth) + 55, ssnY, boxWidth, boxHeight);
      if (einDigits[i]) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(einDigits[i], einX + ((i - 2) * boxWidth) + 55 + 6, ssnY + 15);
      }
    }
  } else {
    // Draw empty EIN boxes
    for (let i = 0; i < 2; i++) {
      doc.rect(einX + (i * boxWidth), ssnY, boxWidth, boxHeight);
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('—', einX + 40, ssnY + 15);
    for (let i = 2; i < 9; i++) {
      doc.rect(einX + ((i - 2) * boxWidth) + 55, ssnY, boxWidth, boxHeight);
    }
  }

  // ============================================================================
  // PART II: CERTIFICATION
  // ============================================================================
  
  currentY = ssnY + boxHeight + 30;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Part II', margin, currentY);
  doc.text('Certification', margin + 40, currentY);
  currentY += 5;
  doc.setLineWidth(1);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 15;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Under penalties of perjury, I certify that:', margin, currentY);
  
  doc.setFont('helvetica', 'normal');
  currentY += 10;
  doc.text('1. The number shown on this form is my correct taxpayer identification number, and', margin + 10, currentY);
  currentY += 10;
  doc.text('2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified', margin + 10, currentY);
  currentY += 8;
  doc.text('    by the IRS that I am subject to backup withholding, or (c) the IRS has notified me that I am no longer subject to backup withholding, and', margin + 10, currentY);
  currentY += 10;
  doc.text('3. I am a U.S. citizen or other U.S. person (defined below), and', margin + 10, currentY);
  currentY += 10;
  doc.text('4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.', margin + 10, currentY);

  // ============================================================================
  // SIGNATURE SECTION
  // ============================================================================
  
  currentY += 25;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Sign Here', margin, currentY);
  
  currentY += 5;
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY, contentWidth * 0.7, 35);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature of U.S. person', margin + 5, currentY + 30);
  
  // Add signature image if available
  if (signature) {
    try {
      doc.addImage(signature, 'PNG', margin + 10, currentY + 5, 150, 20);
    } catch (e) {
      console.warn('Could not add signature image:', e);
    }
  }
  
  // Date box
  const dateBoxX = margin + (contentWidth * 0.7) + 10;
  doc.rect(dateBoxX, currentY, contentWidth * 0.3 - 10, 35);
  doc.text('Date', dateBoxX + 5, currentY + 30);
  
  if (signatureDate) {
    doc.setFontSize(10);
    doc.text(signatureDate, dateBoxX + 10, currentY + 15);
  }

  // ============================================================================
  // FOOTER
  // ============================================================================
  
  currentY += 50;
  doc.setFontSize(7);
  doc.text('Cat. No. 10231X', margin, currentY);
  doc.text('Form W-9 (Rev. 3-2024)', pageWidth - margin - 80, currentY);

  return doc;
}

export function downloadFormW9(options: GenerateW9Options): void {
  const doc = generateW9(options);
  const name = options.w9Form.name_on_return?.replace(/\s+/g, '_') || 'form';
  doc.save(`W-9_${name}.pdf`);
}

export function getW9Blob(options: GenerateW9Options): Blob {
  const doc = generateW9(options);
  return doc.output('blob');
}
