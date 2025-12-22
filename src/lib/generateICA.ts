import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export interface ICAFormData {
  contractorName: string;
  contractorAddress?: string | null;
  signature?: string | null;
  signedAt?: string | null;
}

export function generateICA(data: ICAFormData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const contentWidth = pageWidth - (margin * 2);

  let currentY = 60;

  // ============================================================================
  // HEADER
  // ============================================================================
  
  // Company logo/name
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 210, 220);
  doc.text('FAIRFIELD', margin, currentY);
  
  // Horizontal line
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(24);
  doc.line(margin, currentY + 12, margin + 240, currentY + 12);
  
  // GROUP text
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text('GROUP', margin + 250, currentY + 18);
  
  // Reset colors
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  
  // ============================================================================
  // TITLE
  // ============================================================================
  
  currentY += 55;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INDEPENDENT CONTRACTOR AGREEMENT', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 25;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateText = data.signedAt 
    ? `This Agreement is entered into as of ${format(new Date(data.signedAt), 'MMMM dd, yyyy')}`
    : 'This Agreement is entered into as of the date signed below';
  doc.text(dateText, pageWidth / 2, currentY, { align: 'center' });
  
  // ============================================================================
  // PARTIES
  // ============================================================================
  
  currentY += 35;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTIES:', margin, currentY);
  
  currentY += 18;
  doc.setFont('helvetica', 'normal');
  doc.text('Company: Fairfield Response Group LLC', margin, currentY);
  
  currentY += 15;
  doc.text(`Contractor: ${data.contractorName}`, margin, currentY);
  
  if (data.contractorAddress) {
    currentY += 15;
    doc.text(`Address: ${data.contractorAddress}`, margin, currentY);
  }
  
  // ============================================================================
  // AGREEMENT SECTIONS
  // ============================================================================
  
  const sections = [
    {
      title: '1. ENGAGEMENT',
      content: 'The Company hereby engages the Contractor, and the Contractor agrees to provide services to the Company as an independent contractor, subject to the terms and conditions set forth in this Agreement.'
    },
    {
      title: '2. SERVICES',
      content: 'The Contractor shall provide such services as may be assigned by the Company from time to time. The Contractor shall perform all services in a professional and workmanlike manner, consistent with industry standards.'
    },
    {
      title: '3. INDEPENDENT CONTRACTOR STATUS',
      content: 'The Contractor is an independent contractor and not an employee, partner, or agent of the Company. The Contractor shall not be entitled to any employee benefits, including but not limited to health insurance, retirement benefits, or paid time off. The Contractor is responsible for paying all taxes arising from compensation received under this Agreement.'
    },
    {
      title: '4. COMPENSATION',
      content: "The Company shall pay the Contractor for services at rates agreed upon in writing. Payment shall be made according to the Company's standard payment schedule for contractors."
    },
    {
      title: '5. CONFIDENTIALITY',
      content: 'The Contractor agrees to keep confidential all proprietary information, trade secrets, and business information of the Company and its clients. This obligation shall survive the termination of this Agreement.'
    },
    {
      title: '6. WORK PRODUCT',
      content: 'All work product created by the Contractor in the performance of services under this Agreement shall be the sole property of the Company or its clients, as applicable.'
    },
    {
      title: '7. INSURANCE',
      content: "The Contractor shall maintain adequate liability insurance and workers' compensation insurance as required by law."
    },
    {
      title: '8. TERMINATION',
      content: 'Either party may terminate this Agreement at any time, with or without cause, upon written notice to the other party.'
    },
    {
      title: '9. GOVERNING LAW',
      content: 'This Agreement shall be governed by and construed in accordance with the laws of the state in which the Company is located.'
    }
  ];
  
  currentY += 25;
  
  sections.forEach(section => {
    // Check if we need a new page
    if (currentY > pageHeight - 100) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(section.title, margin, currentY);
    
    currentY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const splitText = doc.splitTextToSize(section.content, contentWidth);
    doc.text(splitText, margin, currentY);
    currentY += splitText.length * 12 + 12;
  });
  
  // ============================================================================
  // SIGNATURE SECTION
  // ============================================================================
  
  // Check if we need a new page for signature
  if (currentY > pageHeight - 150) {
    doc.addPage();
    currentY = margin;
  }
  
  currentY += 20;
  
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, margin + contentWidth, currentY);
  
  currentY += 25;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SIGNATURE', margin, currentY);
  
  currentY += 20;
  
  // Contractor signature area
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Contractor Signature:', margin, currentY);
  
  // Add signature image if available
  if (data.signature?.startsWith('data:image')) {
    try {
      doc.addImage(data.signature, 'PNG', margin + 110, currentY - 30, 150, 30);
    } catch (e) {
      if (data.signature) {
        doc.setFont('helvetica', 'italic');
        doc.text(data.signature, margin + 115, currentY - 5);
      }
    }
  } else if (data.signature) {
    doc.setFont('helvetica', 'italic');
    doc.text(data.signature, margin + 115, currentY - 5);
  }
  
  doc.setFont('helvetica', 'normal');
  doc.line(margin + 110, currentY + 2, margin + 300, currentY + 2);
  
  currentY += 20;
  doc.text('Date:', margin, currentY);
  doc.line(margin + 35, currentY + 2, margin + 150, currentY + 2);
  
  if (data.signedAt) {
    doc.text(format(new Date(data.signedAt), 'MMMM dd, yyyy'), margin + 40, currentY);
  }
  
  currentY += 20;
  doc.text('Printed Name:', margin, currentY);
  doc.line(margin + 80, currentY + 2, margin + 300, currentY + 2);
  doc.text(data.contractorName, margin + 85, currentY);
  
  // ============================================================================
  // FOOTER
  // ============================================================================
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Fairfield Response Group LLC - Independent Contractor Agreement', pageWidth / 2, pageHeight - 30, { align: 'center' });
  
  return doc;
}

export function downloadICAForm(data: ICAFormData): void {
  const doc = generateICA(data);
  const fileName = `Independent_Contractor_Agreement_${data.contractorName?.replace(/\s+/g, '_') || 'Form'}.pdf`;
  doc.save(fileName);
}
