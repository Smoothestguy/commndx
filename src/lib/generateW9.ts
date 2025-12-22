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
  const pageHeight = 792;
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
  doc.setFontSize(6);
  doc.text('(For a sole proprietor or disregarded entity, enter the owner\'s name on line 1, and enter the business/disregarded', margin + 10, currentY + 8);
  doc.text('entity\'s name on line 2.)', margin + 10, currentY + 16);

  // Line 1 input box
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY + 20, contentWidth, 20);
  if (w9Form.name_on_return) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(w9Form.name_on_return, margin + 5, currentY + 33);
  }

  // ============================================================================
  // LINE 2: BUSINESS NAME
  // ============================================================================
  
  currentY += 50;
  
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
  doc.text('Check only one of the following seven boxes.', margin + 15, currentY + 8);

  const checkboxY = currentY + 20;
  const checkboxSize = 10;
  const checkboxSpacing = 85;

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
  drawCheckbox(margin + 15 + checkboxSpacing * 1.8, checkboxY, 'C corporation', taxClassification === 'c_corp');
  drawCheckbox(margin + 15 + checkboxSpacing * 3, checkboxY, 'S corporation', taxClassification === 's_corp');
  drawCheckbox(margin + 15 + checkboxSpacing * 4.2, checkboxY, 'Partnership', taxClassification === 'partnership');

  // Second row of checkboxes
  const checkbox2Y = checkboxY + 15;
  drawCheckbox(margin + 15, checkbox2Y, 'Trust/estate', taxClassification === 'trust');

  // LLC checkbox with classification input
  const llcX = margin + 15 + checkboxSpacing * 1.3;
  drawCheckbox(llcX, checkbox2Y, 'LLC. Enter the tax classification (C = C corporation, S = S corporation, P = Partnership)', taxClassification === 'llc');
  
  // Draw small box for LLC classification and fill it in
  if (taxClassification === 'llc') {
    const llcInputX = llcX + 425;
    const llcInputY = checkbox2Y;
    doc.rect(llcInputX, llcInputY, 15, checkboxSize);
    
    if (llcClassification) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(llcClassification.toUpperCase(), llcInputX + 4, llcInputY + 8);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
    }
  }

  // Note about LLC
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Note:', margin + 20, checkbox2Y + 25);
  doc.setFont('helvetica', 'normal');
  doc.text('Check the "LLC" box above and, in the entry space, enter the appropriate code (C, S, or P) for the tax', margin + 38, checkbox2Y + 25);
  doc.text('classification of the LLC, unless it is a disregarded entity. A disregarded entity should instead check the appropriate', margin + 20, checkbox2Y + 33);
  doc.text('box for the tax classification of its owner.', margin + 20, checkbox2Y + 41);

  // Other checkbox
  const otherY = checkbox2Y + 50;
  drawCheckbox(margin + 15, otherY, 'Other (see instructions)', taxClassification === 'other');
  if (taxClassification === 'other' && w9Form.other_classification) {
    doc.rect(margin + 120, otherY, 100, checkboxSize);
    doc.setFontSize(9);
    doc.text(w9Form.other_classification, margin + 125, otherY + 7);
  }

  // ============================================================================
  // LINE 3B: FOREIGN PARTNERS
  // ============================================================================
  
  currentY = otherY + 20;
  
  // Check if Line 3b applies
  const showLine3b = taxClassification === 'partnership' || taxClassification === 'trust' || 
    (taxClassification === 'llc' && llcClassification?.toLowerCase() === 'p');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('3b', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('If on line 3a you checked "Partnership" or "Trust/estate," or checked "LLC" and entered "P" as its tax classification,', margin + 15, currentY);
  doc.text('and you are providing this form to a partnership, trust, or estate in which you have an ownership interest, check', margin + 15, currentY + 8);
  doc.text('this box if you have any foreign partners, owners, or beneficiaries. See instructions', margin + 15, currentY + 16);
  
  // Foreign partners checkbox - positioned on the right
  const foreignCheckY = currentY + 8;
  doc.rect(pageWidth - margin - 15, foreignCheckY - 8, checkboxSize, checkboxSize);
  
  // Check the box if has_foreign_partners is true and Line 3b applies
  if (showLine3b && w9Form.has_foreign_partners) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('X', pageWidth - margin - 13, foreignCheckY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
  }

  // ============================================================================
  // LINE 4: EXEMPTIONS
  // ============================================================================
  
  currentY += 40;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('4', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('Exemptions (codes apply only to', margin + 10, currentY);
  doc.text('certain entities, not individuals;', margin + 10, currentY + 8);
  doc.text('see instructions on page 3):', margin + 10, currentY + 16);

  // Exemption boxes
  const exemptX = margin + 140;
  doc.text('Exempt payee code (if any)', exemptX, currentY);
  doc.rect(exemptX, currentY + 5, 60, 18);
  if (w9Form.exempt_payee_code) {
    doc.setFontSize(10);
    doc.text(w9Form.exempt_payee_code, exemptX + 5, currentY + 17);
  }

  const fatcaX = exemptX + 150;
  doc.setFontSize(7);
  doc.text('Exemption from Foreign Account Tax', fatcaX, currentY);
  doc.text('Compliance Act (FATCA) reporting', fatcaX, currentY + 8);
  doc.text('code (if any)', fatcaX, currentY + 16);
  doc.setFontSize(6);
  doc.text('(Applies to accounts maintained', fatcaX, currentY + 24);
  doc.text('outside the United States.)', fatcaX, currentY + 31);
  doc.rect(fatcaX + 145, currentY + 5, 60, 18);
  if (w9Form.fatca_exemption_code) {
    doc.setFontSize(10);
    doc.text(w9Form.fatca_exemption_code, fatcaX + 150, currentY + 17);
  }

  // ============================================================================
  // LINE 5: ADDRESS
  // ============================================================================
  
  currentY += 50;
  
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

  // Requester box
  const requesterX = margin + (contentWidth * 0.6) + 10;
  doc.setFontSize(7);
  doc.text('Requester\'s name and address (optional)', requesterX, currentY);
  doc.rect(requesterX, currentY + 5, contentWidth * 0.4 - 10, 20);

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
  doc.text('Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid', margin, currentY);
  doc.text('backup withholding. For individuals, this is generally your social security number (SSN). However, for a', margin, currentY + 8);
  doc.text('resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other', margin, currentY + 16);
  doc.text('entities, it is your employer identification number (EIN). If you do not have a number, see How to get a', margin, currentY + 24);
  doc.text('TIN, later.', margin, currentY + 32);

  currentY += 42;
  doc.setFont('helvetica', 'bold');
  doc.text('Note:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('If the account is in more than one name, see the instructions for line 1. See also What Name and', margin + 25, currentY);
  doc.text('Number To Give the Requester for guidelines on whose number to enter.', margin, currentY + 8);

  // TIN Display Logic: Prioritize EIN for business entities, SSN for individuals
  currentY += 25;
  const boxWidth = 18;
  const boxHeight = 22;
  
  // Determine which TIN to display
  const useEIN = ein && (taxClassification !== 'individual');
  const ssnY = currentY + 10;

  if (useEIN) {
    // Show EIN only (or both with "or" if SSN also provided)
    const showSSN = (ssnFull || ssnLastFour);
    
    if (showSSN) {
      // Show SSN on left
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Social security number', margin, currentY);
      
      const ssnFormatted = maskSSN(ssnLastFour || null, ssnFull || null);
      const ssnDigits = ssnFormatted.replace(/-/g, '').split('');
      
      // Draw SSN boxes (XXX-XX-XXXX format)
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
      doc.text('—', margin + (3 * boxWidth) + 5, ssnY + 15);
      
      for (let i = 3; i < 5; i++) {
        doc.rect(margin + (i * boxWidth) + 12, ssnY, boxWidth, boxHeight);
        if (ssnDigits[i] && ssnDigits[i] !== '*') {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'normal');
          doc.text(ssnDigits[i], margin + (i * boxWidth) + 12 + 6, ssnY + 15);
        } else if (ssnDigits[i] === '*') {
          doc.text('*', margin + (i * boxWidth) + 12 + 6, ssnY + 15);
        }
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('—', margin + (5 * boxWidth) + 17, ssnY + 15);
      
      for (let i = 5; i < 9; i++) {
        doc.rect(margin + (i * boxWidth) + 24, ssnY, boxWidth, boxHeight);
        if (ssnDigits[i] && ssnDigits[i] !== '*') {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'normal');
          doc.text(ssnDigits[i], margin + (i * boxWidth) + 24 + 6, ssnY + 15);
        } else if (ssnDigits[i] === '*') {
          doc.text('*', margin + (i * boxWidth) + 24 + 6, ssnY + 15);
        }
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('or', margin + 200, ssnY + 15);
    }
    
    // Show EIN
    const einStartX = showSSN ? margin + 230 : margin;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Employer identification number', einStartX, currentY);
    
    const einFormatted = formatEIN(ein);
    const einDigits = einFormatted.replace(/-/g, '').split('');
    
    // Draw EIN boxes (XX-XXXXXXX format)
    for (let i = 0; i < 2; i++) {
      doc.rect(einStartX + (i * boxWidth), ssnY, boxWidth, boxHeight);
      if (einDigits[i]) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(einDigits[i], einStartX + (i * boxWidth) + 6, ssnY + 15);
      }
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('—', einStartX + (2 * boxWidth) + 5, ssnY + 15);
    
    for (let i = 2; i < 9; i++) {
      doc.rect(einStartX + (i * boxWidth) + 12, ssnY, boxWidth, boxHeight);
      if (einDigits[i]) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(einDigits[i], einStartX + (i * boxWidth) + 12 + 6, ssnY + 15);
      }
    }
  } else {
    // Show SSN only (individual/sole proprietor)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Social security number', margin, currentY);
    
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
    doc.text('—', margin + (3 * boxWidth) + 5, ssnY + 15);
    
    for (let i = 3; i < 5; i++) {
      doc.rect(margin + (i * boxWidth) + 12, ssnY, boxWidth, boxHeight);
      if (ssnDigits[i] && ssnDigits[i] !== '*') {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(ssnDigits[i], margin + (i * boxWidth) + 12 + 6, ssnY + 15);
      } else if (ssnDigits[i] === '*') {
        doc.text('*', margin + (i * boxWidth) + 12 + 6, ssnY + 15);
      }
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('—', margin + (5 * boxWidth) + 17, ssnY + 15);
    
    for (let i = 5; i < 9; i++) {
      doc.rect(margin + (i * boxWidth) + 24, ssnY, boxWidth, boxHeight);
      if (ssnDigits[i] && ssnDigits[i] !== '*') {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(ssnDigits[i], margin + (i * boxWidth) + 24 + 6, ssnY + 15);
      } else if (ssnDigits[i] === '*') {
        doc.text('*', margin + (i * boxWidth) + 24 + 6, ssnY + 15);
      }
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('or', margin + 200, ssnY + 15);
    
    // Show empty EIN boxes
    doc.setFontSize(8);
    doc.text('Employer identification number', margin + 230, currentY);
    
    const einStartX = margin + 230;
    for (let i = 0; i < 2; i++) {
      doc.rect(einStartX + (i * boxWidth), ssnY, boxWidth, boxHeight);
    }
    
    doc.setFontSize(14);
    doc.text('—', einStartX + (2 * boxWidth) + 5, ssnY + 15);
    
    for (let i = 2; i < 9; i++) {
      doc.rect(einStartX + (i * boxWidth) + 12, ssnY, boxWidth, boxHeight);
    }
  }

  // ============================================================================
  // PART II: CERTIFICATION
  // ============================================================================
  
  currentY = ssnY + boxHeight + 20;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Part II', margin, currentY);
  doc.text('Certification', margin + 40, currentY);
  currentY += 5;
  doc.setLineWidth(1);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 15;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Under penalties of perjury, I certify that:', margin, currentY);

  currentY += 10;
  const certText = [
    '1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and',
    '2. I am not subject to backup withholding because (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue',
    '    Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am',
    '    no longer subject to backup withholding; and',
    '3. I am a U.S. citizen or other U.S. person (defined below); and',
    '4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.'
  ];

  certText.forEach((line, index) => {
    doc.text(line, margin, currentY + (index * 8));
  });

  currentY += (certText.length * 8) + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Certification instructions.', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text('You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding', margin + 95, currentY);
  doc.text('because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid,', margin, currentY + 8);
  doc.text('acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and, generally, payments', margin, currentY + 16);
  doc.text('other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN. See the instructions for Part II, later.', margin, currentY + 24);

  // ============================================================================
  // SIGNATURE SECTION
  // ============================================================================
  
  currentY += 40;
  
  doc.setLineWidth(1.5);
  doc.rect(margin, currentY, contentWidth, 50);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Sign', margin + 5, currentY + 15);
  doc.text('Here', margin + 5, currentY + 23);

  // Signature line
  const sigLineY = currentY + 30;
  doc.setLineWidth(0.5);
  doc.line(margin + 60, sigLineY, margin + 360, sigLineY);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature of', margin + 60, currentY + 15);
  doc.text('U.S. person', margin + 60, currentY + 23);

  if (signature) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'italic');
    doc.text(signature, margin + 65, sigLineY - 5);
  }

  // Date line
  const dateLineY = sigLineY;
  doc.line(margin + 380, dateLineY, pageWidth - margin - 10, dateLineY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Date', margin + 380, currentY + 15);

  if (signatureDate) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(signatureDate, margin + 385, dateLineY - 5);
  }

  // ============================================================================
  // FOOTER: Cat No and Form ID
  // ============================================================================
  
  // Form identifier at bottom
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Cat. No. 10231X', margin, pageHeight - 25);
  doc.setFont('helvetica', 'bold');
  doc.text('Form W-9 (Rev. 3-2024)', pageWidth - margin - 80, pageHeight - 25);

  return doc;
}

// Export helper functions
export function downloadFormW9(options: GenerateW9Options): void {
  const doc = generateW9(options);
  const fileName = `W-9_${options.w9Form.name_on_return.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

export function getW9Blob(options: GenerateW9Options): Blob {
  const doc = generateW9(options);
  return doc.output('blob');
}
