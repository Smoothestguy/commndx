import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export interface DirectDepositFormData {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  accountType?: string | null;
  routingNumber?: string | null;
  accountNumber?: string | null;
  signature?: string | null;
  signedAt?: string | null;
}

export function generateDirectDeposit(data: DirectDepositFormData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = 612;
  const margin = 54; // 0.75 inch
  const contentWidth = pageWidth - (margin * 2);

  // ============================================================================
  // FAIRFIELD BRANDING HEADER
  // ============================================================================
  
  // FAIRFIELD text - light gray
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 210, 220);
  doc.text('FAIRFIELD', margin, 70);
  
  // Horizontal line under FAIRFIELD
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(30);
  doc.line(margin, 85, margin + 280, 85);
  
  // GROUP text - light gray
  doc.setFontSize(24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 220);
  doc.text('GROUP', margin + 290, 95);
  
  // Reset text color to black
  doc.setTextColor(0, 0, 0);
  
  // ============================================================================
  // FORM TITLE
  // ============================================================================
  
  let currentY = 130;
  
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECT DEPOSIT AUTHORIZATION FORM', margin, currentY);
  
  // ============================================================================
  // EMPLOYEE/CONTRACTOR INFORMATION
  // ============================================================================
  
  currentY += 30;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee/Contractor Information', margin, currentY);
  
  currentY += 20;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Name
  doc.text('Name:', margin, currentY);
  doc.line(margin + 40, currentY + 2, margin + contentWidth, currentY + 2);
  if (data.name) {
    doc.text(data.name, margin + 45, currentY);
  }
  
  // Address
  currentY += 25;
  doc.text('Address:', margin, currentY);
  doc.line(margin + 50, currentY + 2, margin + 250, currentY + 2);
  const address = data.address || '';
  if (address) {
    doc.text(address, margin + 55, currentY);
  }
  
  // City, State, ZIP
  doc.text('City, State, ZIP Code:', margin + 260, currentY);
  doc.line(margin + 385, currentY + 2, margin + contentWidth, currentY + 2);
  const cityStateZip = [data.city, data.state, data.zip].filter(Boolean).join(', ');
  if (cityStateZip) {
    doc.setFontSize(10);
    doc.text(cityStateZip, margin + 390, currentY);
    doc.setFontSize(11);
  }
  
  // Phone
  currentY += 25;
  doc.text('Phone Number:', margin, currentY);
  doc.line(margin + 85, currentY + 2, margin + contentWidth, currentY + 2);
  if (data.phone) {
    doc.text(data.phone, margin + 90, currentY);
  }
  
  // Email
  currentY += 25;
  doc.text('Email Address:', margin, currentY);
  doc.line(margin + 85, currentY + 2, margin + contentWidth, currentY + 2);
  if (data.email) {
    doc.text(data.email, margin + 90, currentY);
  }
  
  // ============================================================================
  // BANK INFORMATION
  // ============================================================================
  
  currentY += 40;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Bank Information', margin, currentY);
  
  currentY += 20;
  doc.setFont('helvetica', 'normal');
  
  // Bank Name
  doc.text('Bank Name:', margin, currentY);
  doc.line(margin + 70, currentY + 2, margin + contentWidth, currentY + 2);
  if (data.bankName) {
    doc.text(data.bankName, margin + 75, currentY);
  }
  
  // ============================================================================
  // ACCOUNT INFORMATION
  // ============================================================================
  
  currentY += 35;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Account Information', margin, currentY);
  
  currentY += 20;
  doc.setFont('helvetica', 'normal');
  
  // Account Type
  doc.text('Account Type (check one):', margin, currentY);
  
  // Checking checkbox
  const checkboxY = currentY - 8;
  const checkboxSize = 12;
  doc.rect(margin + 155, checkboxY, checkboxSize, checkboxSize);
  if (data.accountType?.toLowerCase() === 'checking') {
    doc.setFont('helvetica', 'bold');
    doc.text('X', margin + 158, currentY - 1);
    doc.setFont('helvetica', 'normal');
  }
  doc.text('Checking', margin + 172, currentY);
  
  // Savings checkbox
  doc.rect(margin + 240, checkboxY, checkboxSize, checkboxSize);
  if (data.accountType?.toLowerCase() === 'savings') {
    doc.setFont('helvetica', 'bold');
    doc.text('X', margin + 243, currentY - 1);
    doc.setFont('helvetica', 'normal');
  }
  doc.text('Savings', margin + 257, currentY);
  
  // Routing Number
  currentY += 25;
  doc.text('Routing Number:', margin, currentY);
  doc.line(margin + 95, currentY + 2, margin + contentWidth, currentY + 2);
  if (data.routingNumber) {
    doc.setFont('courier', 'normal');
    doc.text(data.routingNumber, margin + 100, currentY);
    doc.setFont('helvetica', 'normal');
  }
  
  // Account Number
  currentY += 25;
  doc.text('Account Number:', margin, currentY);
  doc.line(margin + 100, currentY + 2, margin + contentWidth, currentY + 2);
  if (data.accountNumber) {
    doc.setFont('courier', 'normal');
    doc.text(data.accountNumber, margin + 105, currentY);
    doc.setFont('helvetica', 'normal');
  }
  
  // ============================================================================
  // AUTHORIZATION
  // ============================================================================
  
  currentY += 40;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Authorization', margin, currentY);
  
  currentY += 18;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  
  // Authorization paragraph 1
  const authText1 = `I, ${data.name || '________________________'}, authorize Fairfield Response Group LLC to deposit payments directly into the bank account(s) listed above. This authorization will remain in effect until I provide written notification to cancel or change my direct deposit information.`;
  
  const splitText1 = doc.splitTextToSize(authText1, contentWidth);
  doc.text(splitText1, margin, currentY);
  currentY += splitText1.length * 14;
  
  // Authorization paragraph 2
  currentY += 8;
  const authText2 = 'I understand that I am responsible for verifying deposits and ensuring accuracy. Fairfield Response Group LLC is not responsible for errors or delays caused by incorrect or incomplete information provided by me.';
  
  const splitText2 = doc.splitTextToSize(authText2, contentWidth);
  doc.text(splitText2, margin, currentY);
  currentY += splitText2.length * 14;
  
  // ============================================================================
  // SIGNATURE SECTION
  // ============================================================================
  
  currentY += 30;
  doc.setFontSize(11);
  
  // Signature
  doc.text('Signature:', margin, currentY);
  doc.line(margin + 60, currentY + 2, margin + 280, currentY + 2);
  
  // Date
  doc.text('Date:', margin + 320, currentY);
  doc.line(margin + 350, currentY + 2, margin + contentWidth, currentY + 2);
  
  // Add signature image if available
  if (data.signature?.startsWith('data:image')) {
    try {
      doc.addImage(data.signature, 'PNG', margin + 65, currentY - 35, 180, 35);
    } catch (e) {
      // If image fails, add text signature
      if (data.signature) {
        doc.setFont('helvetica', 'italic');
        doc.text(data.signature, margin + 65, currentY - 5);
        doc.setFont('helvetica', 'normal');
      }
    }
  } else if (data.signature) {
    doc.setFont('helvetica', 'italic');
    doc.text(data.signature, margin + 65, currentY - 5);
    doc.setFont('helvetica', 'normal');
  }
  
  // Add date
  if (data.signedAt) {
    const formattedDate = format(new Date(data.signedAt), 'MM/dd/yyyy');
    doc.text(formattedDate, margin + 355, currentY - 5);
  }
  
  return doc;
}

export function downloadDirectDepositForm(data: DirectDepositFormData): void {
  const doc = generateDirectDeposit(data);
  const fileName = `Direct_Deposit_Authorization_${data.name?.replace(/\s+/g, '_') || 'Form'}.pdf`;
  doc.save(fileName);
}
