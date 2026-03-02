import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export interface VendorAgreementData {
  vendorName: string;
  companyName?: string | null;
  vendorAddress?: string | null;
  signature?: string | null;
  signedAt?: string | null;
}

export function generateVendorAgreement(data: VendorAgreementData): jsPDF {
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

  // HEADER
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 210, 220);
  doc.text('FAIRFIELD', margin, currentY);

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(24);
  doc.line(margin, currentY + 12, margin + 240, currentY + 12);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text('GROUP', margin + 250, currentY + 18);

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // TITLE
  currentY += 55;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDOR AGREEMENT', pageWidth / 2, currentY, { align: 'center' });

  currentY += 25;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateText = data.signedAt
    ? `This Agreement is entered into as of ${format(new Date(data.signedAt), 'MMMM dd, yyyy')}`
    : 'This Agreement is entered into as of the date signed below';
  doc.text(dateText, pageWidth / 2, currentY, { align: 'center' });

  // PARTIES
  currentY += 35;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTIES:', margin, currentY);

  currentY += 18;
  doc.setFont('helvetica', 'normal');
  doc.text('Company: Fairfield Response Group LLC', margin, currentY);

  currentY += 15;
  doc.text(`Vendor: ${data.vendorName}`, margin, currentY);

  if (data.companyName) {
    currentY += 15;
    doc.text(`DBA / Company: ${data.companyName}`, margin, currentY);
  }

  if (data.vendorAddress) {
    currentY += 15;
    doc.text(`Address: ${data.vendorAddress}`, margin, currentY);
  }

  // SECTIONS
  const sections = [
    {
      title: '1. SCOPE OF SERVICES',
      content: 'The Vendor agrees to provide goods and/or services to the Company as described in individual purchase orders, work orders, or other written agreements. All services shall be performed in a professional and workmanlike manner consistent with industry standards.'
    },
    {
      title: '2. INDEPENDENT CONTRACTOR STATUS',
      content: 'The Vendor is an independent contractor and not an employee, partner, or agent of the Company. The Vendor shall be solely responsible for the means, methods, and manner of performing services. The Vendor is responsible for paying all applicable taxes and maintaining appropriate insurance coverage.'
    },
    {
      title: '3. COMPENSATION AND PAYMENT',
      content: "The Company shall compensate the Vendor at the rates specified in applicable purchase orders or as otherwise agreed upon in writing. Payment shall be made according to the payment terms established for the Vendor account."
    },
    {
      title: '4. INSURANCE AND LICENSING',
      content: "The Vendor shall maintain all required licenses, permits, and insurance coverage necessary for the performance of services. The Vendor shall provide proof of insurance upon request and shall maintain coverage for the duration of any active engagement."
    },
    {
      title: '5. CONFIDENTIALITY',
      content: 'The Vendor agrees to keep confidential all proprietary information, trade secrets, client information, and business information of the Company. This obligation shall survive the termination of this Agreement.'
    },
    {
      title: '6. INDEMNIFICATION',
      content: 'The Vendor shall indemnify and hold harmless the Company, its officers, employees, and agents from any claims, damages, losses, or expenses arising from the Vendor\'s performance of services or breach of this Agreement.'
    },
    {
      title: '7. COMPLIANCE',
      content: 'The Vendor shall comply with all applicable federal, state, and local laws, regulations, and ordinances in the performance of services under this Agreement.'
    },
    {
      title: '8. TERMINATION',
      content: 'Either party may terminate this Agreement at any time, with or without cause, upon written notice to the other party. Termination shall not affect obligations arising prior to the termination date.'
    },
    {
      title: '9. GOVERNING LAW',
      content: 'This Agreement shall be governed by and construed in accordance with the laws of the state in which the Company is located.'
    }
  ];

  currentY += 25;

  sections.forEach(section => {
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

  // SIGNATURE
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Vendor Signature:', margin, currentY);

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
  doc.text('Vendor Name:', margin, currentY);
  doc.line(margin + 80, currentY + 2, margin + 300, currentY + 2);
  doc.text(data.vendorName, margin + 85, currentY);

  if (data.companyName) {
    currentY += 20;
    doc.text('Company:', margin, currentY);
    doc.line(margin + 60, currentY + 2, margin + 300, currentY + 2);
    doc.text(data.companyName, margin + 65, currentY);
  }

  // FOOTER
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Fairfield Response Group LLC - Vendor Agreement', pageWidth / 2, pageHeight - 30, { align: 'center' });

  return doc;
}

export function downloadVendorAgreement(data: VendorAgreementData): void {
  const doc = generateVendorAgreement(data);
  const fileName = `Vendor_Agreement_${data.vendorName?.replace(/\s+/g, '_') || 'Form'}.pdf`;
  doc.save(fileName);
}
