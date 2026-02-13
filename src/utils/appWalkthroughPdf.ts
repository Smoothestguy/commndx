import jsPDF from "jspdf";
import {
  PDF_COLORS,
  PDF_FONTS,
  PDF_MARGIN,
  setColor,
  setFillColor,
  drawSeparatorLine,
  drawFooter,
  createPageBreakChecker,
  getDefaultCompanyInfo,
  drawDocumentHeader,
} from "./pdfHelpers";

// ==================== CONTENT DATA ====================
interface Section {
  title: string;
  subsections: { heading: string; bullets: string[] }[];
}

const SECTIONS: Section[] = [
  {
    title: "1. System Architecture & Layout",
    subsections: [
      {
        heading: "Three-Panel Layout",
        bullets: [
          "Left panel: Collapsible sidebar with module navigation, quick actions, and recent activity feed.",
          "Center panel: Main content area with contextual toolbars, filters, and data tables.",
          "Right panel: Detail/preview pane that opens when a record is selected — shows full record info without leaving the list.",
        ],
      },
      {
        heading: "Role-Based Access Control",
        bullets: [
          "Admin: Full system access — user management, company settings, audit logs, entity merging, permissions.",
          "Manager: Project oversight, approval workflows (estimates, POs, time entries), report generation.",
          "User: Day-to-day operations — create estimates, log time, manage assigned projects.",
          "Portal Users: Personnel, Vendors, and Subcontractors each have dedicated external portals with limited access.",
        ],
      },
    ],
  },
  {
    title: "2. Authentication & User Management",
    subsections: [
      {
        heading: "Authentication Flow",
        bullets: [
          "Email/password signup with email verification (no auto-confirm).",
          "Session management via secure tokens with automatic refresh.",
          "Password reset flow with email-based recovery links.",
          "Protected routes redirect unauthenticated users to login.",
        ],
      },
      {
        heading: "User Profiles",
        bullets: [
          "Profile creation on first login via database trigger.",
          "Roles assigned by Admin: admin, manager, user.",
          "Profile includes display name, avatar, contact info, and role.",
        ],
      },
    ],
  },
  {
    title: "3. Dashboard & Navigation",
    subsections: [
      {
        heading: "Main Dashboard",
        bullets: [
          "KPI cards: Active projects, open estimates, pending invoices, revenue summary.",
          "Recent activity feed showing latest actions across all modules.",
          "Quick action buttons: New Estimate, New Project, Clock In, etc.",
          "Customizable widget layout saved per user.",
        ],
      },
      {
        heading: "Sidebar Navigation",
        bullets: [
          "Grouped by category: CRM, Projects, Financial, Workforce, Admin.",
          "Collapsible sections with icon + label.",
          "Badge indicators for pending approvals and notifications.",
          "Search command palette (Cmd+K) for quick navigation.",
        ],
      },
    ],
  },
  {
    title: "4. Customer Management (CRM)",
    subsections: [
      {
        heading: "Customer Records",
        bullets: [
          "Full CRUD: Create, view, edit, soft-delete customers.",
          "Fields: Name, company, email, phone, address, jobsite address, customer type, tax exempt status.",
          "Activity logging: calls, emails, meetings, notes linked to each customer.",
          "Project linking: View all projects and estimates associated with a customer.",
        ],
      },
      {
        heading: "Entity Merging",
        bullets: [
          "Merge duplicate customers with field-level override selection.",
          "All related records (projects, estimates, invoices) automatically reassigned.",
          "Full audit trail of merge operations with undo capability.",
        ],
      },
    ],
  },
  {
    title: "5. Project Hub",
    subsections: [
      {
        heading: "Project Lifecycle",
        bullets: [
          "Create projects linked to customers with address, description, and status.",
          "Status tracking: Planning → Active → On Hold → Completed → Archived.",
          "Milestone management with target dates and completion tracking.",
          "Financial summary: Budget vs actual, cost breakdown, margin analysis.",
        ],
      },
      {
        heading: "Project Dashboard",
        bullets: [
          "Overview tab: Key metrics, status, assigned personnel, timeline.",
          "Documents tab: All files, photos, and attachments organized by category.",
          "Financial tab: Estimates, job orders, invoices, change orders, POs — all linked.",
          "Personnel tab: Assigned workers with roles, rates, and time logged.",
        ],
      },
    ],
  },
  {
    title: "6. Estimates",
    subsections: [
      {
        heading: "Estimate Creation",
        bullets: [
          "Line items with description, quantity, unit price, vendor cost, markup percentage.",
          "Automatic total calculation: subtotal, tax, grand total.",
          "Product catalog integration for quick line item entry.",
          "Group line items into sections with subtotals.",
        ],
      },
      {
        heading: "Workflow & PDF",
        bullets: [
          "Status flow: Draft → Sent → Approved → Rejected → Converted.",
          "Professional PDF generation with company branding, terms, and signatures.",
          "Convert approved estimate directly into a Job Order with one click.",
          "Version history tracking for estimate revisions.",
        ],
      },
    ],
  },
  {
    title: "7. Job Orders",
    subsections: [
      {
        heading: "Inline-Editable Table",
        bullets: [
          "Click any cell to edit directly — description, quantity, unit price, vendor cost, markup.",
          "Real-time margin calculation as values change.",
          "Drag-and-drop reorder of line items via handle column.",
          "Add/remove rows without leaving the table view.",
        ],
      },
      {
        heading: "Financial Tracking",
        bullets: [
          "Automatic cost vs revenue tracking per line item.",
          "Margin percentage calculated: ((Unit Price - Vendor Cost) / Unit Price) × 100.",
          "Change order integration: additions and deductions tracked separately.",
          "Invoice generation directly from job order line items.",
        ],
      },
    ],
  },
  {
    title: "8. Purchase Orders",
    subsections: [
      {
        heading: "PO Management",
        bullets: [
          "Create POs linked to projects and vendors.",
          "Line items with quantity, unit cost, and total.",
          "Approval workflow: Draft → Pending Approval → Approved → Sent → Received.",
          "PDF generation for sending to vendors.",
        ],
      },
      {
        heading: "Receiving & Billing",
        bullets: [
          "Partial receiving: Mark individual items as received with quantities.",
          "Vendor bill matching against PO line items.",
          "Variance tracking between ordered and received quantities.",
          "Automatic status updates based on receiving progress.",
        ],
      },
    ],
  },
  {
    title: "9. Invoices",
    subsections: [
      {
        heading: "Invoice Generation",
        bullets: [
          "Generate from job orders — pull line items automatically.",
          "Progress billing: Invoice partial amounts against job order totals.",
          "Retention tracking with configurable retention percentage.",
          "Professional PDF with payment terms, due date, and remittance info.",
        ],
      },
      {
        heading: "Payment Tracking",
        bullets: [
          "Record payments against invoices with date, amount, and method.",
          "Aging reports: Current, 30, 60, 90+ day buckets.",
          "Status flow: Draft → Sent → Partial → Paid → Overdue.",
          "Automatic overdue detection based on payment terms.",
        ],
      },
    ],
  },
  {
    title: "10. Personnel Management",
    subsections: [
      {
        heading: "Personnel Records",
        bullets: [
          "Complete worker profiles: Name, contact, address, SSN (encrypted), emergency contacts.",
          "Employment details: Hire date, pay rate, classification, union affiliation.",
          "Certifications and capabilities tracking with expiration dates.",
          "Photo management for ID badges and compliance.",
        ],
      },
      {
        heading: "Assignments & Rates",
        bullets: [
          "Assign personnel to projects with start/end dates.",
          "Rate brackets: Regular, overtime, holiday rates per worker per project.",
          "Asset assignments: Track equipment and tools issued to workers.",
          "Bulk export to Excel for payroll processing.",
        ],
      },
    ],
  },
  {
    title: "11. Time Tracking",
    subsections: [
      {
        heading: "GPS-Enabled Clock In/Out",
        bullets: [
          "Mobile-friendly clock in/out with GPS location capture.",
          "Geofencing: Alerts when workers clock in outside project boundaries.",
          "Idle detection: Flags entries with no movement for extended periods.",
          "Photo capture at clock-in for identity verification.",
        ],
      },
      {
        heading: "Approval Workflow",
        bullets: [
          "Daily time entries reviewed by supervisors.",
          "Bulk approve/reject with notes.",
          "Overtime calculation: Daily (>8hrs) and weekly (>40hrs) thresholds.",
          "Locked period management: Prevent edits to approved/processed periods.",
        ],
      },
    ],
  },
  {
    title: "12. Payroll",
    subsections: [
      {
        heading: "WH-347 Certified Payroll",
        bullets: [
          "Automated WH-347 form generation from approved time entries.",
          "Davis-Bacon wage compliance tracking.",
          "Fringe benefit calculations per classification.",
          "PDF export matching official DOL WH-347 format.",
        ],
      },
      {
        heading: "Pay Period Management",
        bullets: [
          "Configurable pay periods: Weekly, bi-weekly, semi-monthly.",
          "Pay period locking to prevent retroactive changes.",
          "Overtime multiplier configuration (1.5x, 2x for holidays).",
          "Integration-ready export for external payroll systems.",
        ],
      },
    ],
  },
  {
    title: "13. Vendor & Subcontractor Management",
    subsections: [
      {
        heading: "Vendor Registry",
        bullets: [
          "Vendor profiles with contact, payment terms, and tax info.",
          "W-9 document collection and storage.",
          "Compliance tracking: Insurance certificates, licenses, bonding.",
          "Vendor portal for self-service document uploads.",
        ],
      },
      {
        heading: "Subcontractor Portal",
        bullets: [
          "Dedicated login for subcontractors to view assigned work.",
          "Submit time entries, expenses, and progress updates.",
          "Document sharing: Plans, specs, and change orders.",
          "Automated compliance reminders for expiring documents.",
        ],
      },
    ],
  },
  {
    title: "14. Document Management",
    subsections: [
      {
        heading: "File Storage",
        bullets: [
          "Upload files to any record: Projects, estimates, POs, personnel.",
          "Supported formats: PDF, images, Word, Excel, and more.",
          "Organized by category: Plans, contracts, photos, compliance.",
          "Secure cloud storage with role-based access control.",
        ],
      },
      {
        heading: "Document Workflows",
        bullets: [
          "Version tracking for updated documents.",
          "Expiration alerts for compliance documents (insurance, certifications).",
          "Bulk download and export capabilities.",
          "QR code generation for physical document linking.",
        ],
      },
    ],
  },
  {
    title: "15. QuickBooks Integration",
    subsections: [
      {
        heading: "Bidirectional Sync",
        bullets: [
          "Push invoices, customers, and vendors to QuickBooks Online.",
          "Pull payment data back into the ERP.",
          "Field mapping configuration for custom sync rules.",
          "Sync status tracking with error logging and retry.",
        ],
      },
      {
        heading: "Data Mapping",
        bullets: [
          "Map ERP customers to QuickBooks customers.",
          "Map ERP items/products to QuickBooks items.",
          "Account code mapping for proper GL posting.",
          "Conflict resolution for records modified in both systems.",
        ],
      },
    ],
  },
  {
    title: "16. Reports & Analytics",
    subsections: [
      {
        heading: "Project Reports",
        bullets: [
          "Project financial summary: Revenue, costs, margin, progress.",
          "Cost breakdown by category: Labor, materials, subcontractor, equipment.",
          "Timeline analysis: Planned vs actual milestones.",
          "PDF export of comprehensive project reports.",
        ],
      },
      {
        heading: "Financial Summaries",
        bullets: [
          "Revenue dashboard: By project, customer, and time period.",
          "Accounts receivable aging with drill-down.",
          "Profitability analysis across projects and customers.",
          "Custom date range filtering and comparison.",
        ],
      },
    ],
  },
  {
    title: "17. Administrative Tools",
    subsections: [
      {
        heading: "Audit & Compliance",
        bullets: [
          "Complete audit log: Every create, update, delete action recorded.",
          "User, timestamp, IP address, before/after snapshots.",
          "Filterable by user, action type, resource, and date range.",
          "Export audit logs for compliance reporting.",
        ],
      },
      {
        heading: "System Management",
        bullets: [
          "Recycle bin: Soft-deleted records recoverable by admins.",
          "Entity merging: Deduplicate customers, vendors, and personnel.",
          "Permission management: Granular feature-level access control.",
          "Company settings: Branding, tax rates, default terms, footer text.",
        ],
      },
    ],
  },
  {
    title: "18. PDF Generation System",
    subsections: [
      {
        heading: "Document Types",
        bullets: [
          "Estimates: Professional proposals with line items, terms, and signature lines.",
          "Invoices: Branded invoices with payment terms and remittance details.",
          "Work Orders: Field-ready documents with scope, materials, and instructions.",
          "W-9 Tax Forms: Pre-filled W-9 forms for vendor compliance.",
          "Purchase Orders: Vendor-facing POs with line items and delivery details.",
          "WH-347 Certified Payroll: DOL-compliant certified payroll reports.",
        ],
      },
      {
        heading: "PDF Infrastructure",
        bullets: [
          "Built on jsPDF library — fully client-side, no server rendering needed.",
          "Shared helpers: pdfHelpers.ts provides colors, fonts, headers, footers, and page break management.",
          "Company branding: Logo, address, and contact info pulled from company settings.",
          "Consistent styling across all document types with design tokens.",
        ],
      },
    ],
  },
];

// ==================== PDF GENERATION ====================

const addPageFooter = (doc: jsPDF, pageNum: number, totalPages: number, dateStr: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 12;

  setColor(doc, PDF_COLORS.gray500);
  doc.setFontSize(PDF_FONTS.xsmall);
  doc.setFont("helvetica", "normal");
  doc.text("Fairfield Construction Management ERP — Application Walkthrough", PDF_MARGIN, footerY);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - PDF_MARGIN, footerY, { align: "right" });
  doc.text(`Generated ${dateStr}`, pageWidth / 2, footerY, { align: "center" });
};

export const generateAppWalkthroughPDF = async () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * PDF_MARGIN;
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ===== COVER PAGE =====
  // Blue header bar
  setFillColor(doc, PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 60, "F");

  setColor(doc, PDF_COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Fairfield Construction", pageWidth / 2, 28, { align: "center" });
  doc.setFontSize(18);
  doc.text("Management ERP", pageWidth / 2, 40, { align: "center" });

  // Subtitle
  setColor(doc, PDF_COLORS.gray600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("Complete Application Walkthrough", pageWidth / 2, 80, { align: "center" });

  // Date
  doc.setFontSize(PDF_FONTS.body);
  doc.text(`Generated: ${dateStr}`, pageWidth / 2, 92, { align: "center" });

  // Description box
  const descY = 110;
  setFillColor(doc, PDF_COLORS.primaryLight);
  doc.rect(PDF_MARGIN, descY, contentWidth, 50, "F");

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.body);
  const descText = doc.splitTextToSize(
    "This document provides a comprehensive overview of every module, workflow, and feature in the Fairfield Construction Management ERP system. It covers the full lifecycle from customer acquisition through project delivery, including financial management, workforce tracking, compliance, and administrative tools.",
    contentWidth - 10
  );
  descText.forEach((line: string, i: number) => {
    doc.text(line, PDF_MARGIN + 5, descY + 10 + i * 5);
  });

  // Section count
  setColor(doc, PDF_COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONTS.heading);
  doc.text(`${SECTIONS.length} Modules Documented`, pageWidth / 2, 180, { align: "center" });

  // Company footer on cover
  setColor(doc, PDF_COLORS.gray400);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.small);
  doc.text("Fairfield Group — https://fairfieldgp.com/", pageWidth / 2, pageHeight - 20, { align: "center" });

  // ===== TABLE OF CONTENTS =====
  doc.addPage();
  let y = PDF_MARGIN;

  setColor(doc, PDF_COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Table of Contents", PDF_MARGIN, y);
  y += 12;

  drawSeparatorLine(doc, y);
  y += 5;

  setColor(doc, PDF_COLORS.black);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONTS.body);

  SECTIONS.forEach((section, i) => {
    doc.text(section.title, PDF_MARGIN + 5, y);
    y += 7;
    if (y > pageHeight - 30) {
      doc.addPage();
      y = PDF_MARGIN;
    }
  });

  // ===== CONTENT SECTIONS =====
  SECTIONS.forEach((section) => {
    doc.addPage();
    let y = PDF_MARGIN;

    // Section title — blue, bold, 14pt
    setColor(doc, PDF_COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(section.title, PDF_MARGIN, y);
    y += 4;

    // Blue underline
    setFillColor(doc, PDF_COLORS.primary);
    doc.rect(PDF_MARGIN, y, contentWidth, 1, "F");
    y += 8;

    section.subsections.forEach((sub) => {
      // Check page break
      if (y > pageHeight - 50) {
        doc.addPage();
        y = PDF_MARGIN;
      }

      // Subsection heading — black, bold, 11pt
      setColor(doc, PDF_COLORS.black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(PDF_FONTS.subheading);
      doc.text(sub.heading, PDF_MARGIN, y);
      y += 7;

      // Bullet points
      doc.setFont("helvetica", "normal");
      doc.setFontSize(PDF_FONTS.body);
      setColor(doc, PDF_COLORS.gray600);

      sub.bullets.forEach((bullet) => {
        if (y > pageHeight - 25) {
          doc.addPage();
          y = PDF_MARGIN;
        }

        const bulletLines = doc.splitTextToSize(bullet, contentWidth - 12);
        // Draw bullet dot
        setFillColor(doc, PDF_COLORS.gray600);
        doc.circle(PDF_MARGIN + 3, y - 1.2, 0.8, "F");

        bulletLines.forEach((line: string, li: number) => {
          doc.text(line, PDF_MARGIN + 8, y);
          y += 5;
        });
        y += 1; // spacing between bullets
      });

      y += 4; // spacing between subsections
    });
  });

  // ===== ADD PAGE NUMBERS =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages, dateStr);
  }

  // ===== SAVE =====
  const fileName = `Fairfield_ERP_Walkthrough_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};
