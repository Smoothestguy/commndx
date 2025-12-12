import jsPDF from "jspdf";
import { format } from "date-fns";
import { formatCurrencyForPDF, PDF_MARGIN, PDF_COLORS, setColor } from "./pdfHelpers";

interface Project {
  name: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

interface Customer {
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
}

interface Estimate {
  number: string;
  status: string;
  total: number;
  created_at: string;
}

interface JobOrder {
  number: string;
  status: string;
  total: number;
  start_date: string;
}

interface Invoice {
  number: string;
  status: string;
  total: number;
  due_date: string;
}

interface Milestone {
  title: string;
  status: string;
  due_date: string;
  completion_percentage: number;
}

interface ProjectReportData {
  project: Project;
  customer: Customer;
  estimates: Estimate[];
  jobOrders: JobOrder[];
  invoices: Invoice[];
  milestones: Milestone[];
  totals: {
    estimatesTotal: number;
    jobOrdersTotal: number;
    invoicesTotal: number;
    paidTotal: number;
  };
  overallCompletion: number;
}

export const generateProjectReportPDF = (data: ProjectReportData) => {
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Helper function to add page if needed
  const checkAddPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Helper to draw a horizontal line
  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
  };

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  setColor(doc, PDF_COLORS.primary);
  doc.text("Fairfield Group", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;
  setColor(doc, PDF_COLORS.black);
  doc.setFontSize(16);
  doc.text("PROJECT REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Project Info Section
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Project Information", margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Project Name: ${data.project.name}`, margin, yPos);
  yPos += 6;
  doc.text(`Status: ${data.project.status.toUpperCase()}`, margin, yPos);
  yPos += 6;
  doc.text(`Start Date: ${format(new Date(data.project.start_date), "MMM dd, yyyy")}`, margin, yPos);
  yPos += 6;
  doc.text(
    `End Date: ${data.project.end_date ? format(new Date(data.project.end_date), "MMM dd, yyyy") : "Ongoing"}`,
    margin,
    yPos
  );
  yPos += 6;
  doc.text(`Overall Completion: ${data.overallCompletion}%`, margin, yPos);
  yPos += 10;

  // Customer Info
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Information", margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${data.customer.name}`, margin, yPos);
  yPos += 6;
  if (data.customer.company) {
    doc.text(`Company: ${data.customer.company}`, margin, yPos);
    yPos += 6;
  }
  doc.text(`Email: ${data.customer.email}`, margin, yPos);
  yPos += 6;
  if (data.customer.phone) {
    doc.text(`Phone: ${data.customer.phone}`, margin, yPos);
    yPos += 6;
  }
  yPos += 5;

  drawLine();

  // Financial Summary
  checkAddPage(50);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Financial Summary", margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Estimated: ${formatCurrencyForPDF(data.totals.estimatesTotal)}`, margin, yPos);
  yPos += 6;
  doc.text(`Job Orders Total: ${formatCurrencyForPDF(data.totals.jobOrdersTotal)}`, margin, yPos);
  yPos += 6;
  doc.text(`Total Invoiced: ${formatCurrencyForPDF(data.totals.invoicesTotal)}`, margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Paid: ${formatCurrencyForPDF(data.totals.paidTotal)}`, margin, yPos);
  yPos += 10;

  drawLine();

  // Milestones
  if (data.milestones.length > 0) {
    checkAddPage(60);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Milestones (${data.milestones.length})`, margin, yPos);
    yPos += 8;

    data.milestones.forEach((milestone) => {
      checkAddPage(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`• ${milestone.title}`, margin, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.text(
        `  Status: ${milestone.status} | Due: ${format(new Date(milestone.due_date), "MMM dd, yyyy")} | Progress: ${milestone.completion_percentage}%`,
        margin + 5,
        yPos
      );
      yPos += 6;
    });
    yPos += 5;
    drawLine();
  }

  // Estimates
  if (data.estimates.length > 0) {
    checkAddPage(60);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Estimates (${data.estimates.length})`, margin, yPos);
    yPos += 8;

    data.estimates.forEach((estimate) => {
      checkAddPage(15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${estimate.number} - ${estimate.status.toUpperCase()} - ${formatCurrencyForPDF(estimate.total)} - ${format(new Date(estimate.created_at), "MMM dd, yyyy")}`,
        margin,
        yPos
      );
      yPos += 6;
    });
    yPos += 5;
    drawLine();
  }

  // Job Orders
  if (data.jobOrders.length > 0) {
    checkAddPage(60);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Job Orders (${data.jobOrders.length})`, margin, yPos);
    yPos += 8;

    data.jobOrders.forEach((jobOrder) => {
      checkAddPage(15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${jobOrder.number} - ${jobOrder.status.toUpperCase()} - ${formatCurrencyForPDF(jobOrder.total)} - Start: ${format(new Date(jobOrder.start_date), "MMM dd, yyyy")}`,
        margin,
        yPos
      );
      yPos += 6;
    });
    yPos += 5;
    drawLine();
  }

  // Invoices
  if (data.invoices.length > 0) {
    checkAddPage(60);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Invoices (${data.invoices.length})`, margin, yPos);
    yPos += 8;

    data.invoices.forEach((invoice) => {
      checkAddPage(15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${invoice.number} - ${invoice.status.toUpperCase()} - ${formatCurrencyForPDF(invoice.total)} - Due: ${format(new Date(invoice.due_date), "MMM dd, yyyy")}`,
        margin,
        yPos
      );
      yPos += 6;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated on ${format(new Date(), "MMM dd, yyyy 'at' HH:mm")} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `Project_Report_${data.project.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};
