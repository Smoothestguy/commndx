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
    title: "1. Getting Started with Command X",
    subsections: [
      {
        heading: "What is Command X?",
        bullets: [
          "Command X is the construction management ERP platform built for Fairfield Group.",
          "It centralizes every aspect of construction operations — CRM, estimating, job costing, workforce management, payroll, vendor compliance, and financials — in a single system.",
          "Designed for field workers, project managers, office staff, and administrators to collaborate in real time.",
        ],
      },
      {
        heading: "How to Log In & Set Up Your Profile",
        bullets: [
          "Step 1: Navigate to the Command X login page and enter your email and password.",
          "Step 2: If this is your first time, check your email for a verification link and click it to activate your account.",
          "Step 3: After logging in, click your avatar in the top-right corner and select 'Profile' to add your display name, phone, and photo.",
          "Step 4: Your role (Admin, Manager, or User) is assigned by an administrator — contact your admin if you need elevated access.",
        ],
      },
      {
        heading: "Understanding the Interface Layout",
        bullets: [
          "Left Sidebar: Collapsible navigation organized by category (CRM, Projects, Financial, Workforce, Admin). Click any module to navigate.",
          "Center Panel: The main workspace where lists, tables, forms, and dashboards are displayed.",
          "Right Detail Pane: Opens when you select a record — view and edit details without leaving the list view.",
          "Top Bar: Contains search, notifications, portal switcher, and your profile menu.",
        ],
      },
      {
        heading: "Keyboard Shortcuts",
        bullets: [
          "Cmd+K (or Ctrl+K): Open the command palette to quickly search and navigate to any module, record, or action.",
          "Cmd+Shift+P (or Ctrl+Shift+P): Open the portal switcher to jump between Admin, Personnel, Vendor, and Subcontractor portals.",
          "Escape: Close any open dialog, modal, or detail pane.",
        ],
      },
    ],
  },
  {
    title: "2. Step-by-Step Daily Workflows",
    subsections: [
      {
        heading: "For Field Workers",
        bullets: [
          "Step 1: Open Command X on your mobile device and tap 'Clock In'. Your GPS location is captured automatically.",
          "Step 2: Select your assigned project from the list. If geofencing is enabled, you'll be alerted if you're outside the project boundary.",
          "Step 3: Work your shift. The system tracks your active time automatically.",
          "Step 4: When done, tap 'Clock Out'. Your GPS location is captured again.",
          "Step 5: Review your daily time entry and add any notes (e.g., weather delays, equipment issues).",
          "Step 6: Submit your time entries for supervisor approval at the end of each day or week.",
        ],
      },
      {
        heading: "For Project Managers",
        bullets: [
          "Step 1: Log in and review your Dashboard — check KPI cards for active projects, open estimates, and pending invoices.",
          "Step 2: Navigate to Time Tracking → Approvals to review and approve/reject submitted time entries.",
          "Step 3: Go to your Project Hub to check project financials — compare budget vs actual costs and review margin.",
          "Step 4: If work is complete, go to Invoices and generate an invoice from the job order line items.",
          "Step 5: Review any pending Change Orders and approve or reject them with notes.",
          "Step 6: Check the Notifications bell for any alerts requiring your attention (e.g., overdue invoices, expiring certs).",
        ],
      },
      {
        heading: "For Administrators",
        bullets: [
          "Step 1: Review the Admin Dashboard for system-wide alerts and pending items.",
          "Step 2: Go to User Management to add new users, assign roles, and manage permissions.",
          "Step 3: Navigate to Audit Logs to review recent system activity and ensure compliance.",
          "Step 4: Process payroll: Go to Payroll, select the pay period, review approved time entries, and generate WH-347 reports.",
          "Step 5: Check Vendor Compliance — review expiring insurance certificates and send reminders.",
          "Step 6: Run financial reports: Revenue summaries, AR aging, and project profitability analysis.",
        ],
      },
      {
        heading: "For Office Staff",
        bullets: [
          "Step 1: Start with customer inquiries — go to Customers to create or look up client records.",
          "Step 2: Create an Estimate: Select the customer, add line items from the product catalog, set markup, and save as draft.",
          "Step 3: Send the estimate to the customer for approval. Track status in the Estimates list.",
          "Step 4: Once approved, convert the Estimate to a Job Order with one click.",
          "Step 5: When materials are needed, create a Purchase Order linked to the project and vendor.",
          "Step 6: Process incoming Vendor Bills — match them against POs and approve for payment.",
        ],
      },
    ],
  },
  {
    title: "3. When to Use Each Module",
    subsections: [
      {
        heading: "Scenario-to-Module Guide",
        bullets: [
          "New client inquiry? → Go to Customers to create a record and log the interaction.",
          "Need to price a job? → Go to Estimates to build a detailed proposal with line items and markup.",
          "Estimate approved by customer? → Convert it to a Job Order to begin tracking costs.",
          "Need materials or supplies? → Create a Purchase Order linked to the project and vendor.",
          "Work is complete and ready to bill? → Go to Invoices to generate from job order line items.",
          "Customer requests a change? → Create a Change Order to document scope additions or deductions.",
          "Worker needs to get paid? → Go to Payroll to process approved time entries for the pay period.",
          "Vendor insurance expiring? → Check Vendor Management for compliance alerts and send reminders.",
          "Need to check profitability? → Go to Reports for project financial summaries and margin analysis.",
        ],
      },
      {
        heading: "Common Task Flows",
        bullets: [
          "Estimate-to-Invoice Lifecycle: Create Estimate → Send to Customer → Customer Approves → Convert to Job Order → Track Costs → Generate Invoice → Record Payment.",
          "Hire-to-Payroll Lifecycle: Add Personnel → Assign to Project → Set Rate Brackets → Worker Clocks In/Out → Supervisor Approves Time → Run Payroll → Generate WH-347.",
          "PO-to-Payment Lifecycle: Create Purchase Order → Send to Vendor → Receive Materials → Match Vendor Bill → Approve Payment → Sync to QuickBooks.",
          "Change Order Flow: Customer/PM Requests Change → Create Change Order → Add/Remove Line Items → Approve → Update Job Order Totals → Invoice the Change.",
        ],
      },
    ],
  },
  {
    title: "4. Tips, Shortcuts & Best Practices",
    subsections: [
      {
        heading: "Search & Navigation Tips",
        bullets: [
          "Use Cmd+K to search across all modules instantly — type a customer name, project number, or estimate number to jump directly to the record.",
          "Pin your most-used modules to the sidebar favorites for quick access.",
          "Use filters and column sorting on list views to quickly find records — filters persist across sessions.",
          "Click any record in a list to open the detail pane on the right — no need to navigate away from the list.",
        ],
      },
      {
        heading: "PDF Generation & Export Tips",
        bullets: [
          "All PDFs (estimates, invoices, POs, etc.) use your company branding from Settings → Company Info.",
          "Make sure your company logo, address, and contact info are set up before generating PDFs for clients.",
          "Use the 'Export to Excel' buttons on list views for bulk data analysis in spreadsheets.",
          "Walkthrough and report PDFs can be downloaded from Settings → Application Documentation.",
        ],
      },
      {
        heading: "Data Entry Best Practices",
        bullets: [
          "Always link estimates, job orders, and invoices to a Project — this ensures accurate financial tracking.",
          "Use the Product Catalog when adding line items to estimates and job orders for consistency.",
          "Set markup percentages at the line-item level for precise margin control.",
          "Add notes to time entries, change orders, and invoices — they provide critical context for audits and disputes.",
        ],
      },
      {
        heading: "Common Pitfalls to Avoid",
        bullets: [
          "Don't skip email verification — unverified accounts cannot log in.",
          "Don't create duplicate customers or vendors — use Search first, then Entity Merge if duplicates exist.",
          "Don't forget to lock pay periods after processing payroll — this prevents retroactive edits.",
          "Don't send estimates or invoices as 'Draft' — always change status to 'Sent' so tracking works correctly.",
          "Don't ignore compliance alerts — expired insurance or certifications can create liability issues.",
        ],
      },
    ],
  },
  {
    title: "5. System Architecture & Layout",
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
    title: "6. Authentication & User Management",
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
    title: "7. Dashboard & Navigation",
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
    title: "8. Customer Management (CRM)",
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
    title: "9. Project Hub",
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
    title: "10. Estimates",
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
    title: "11. Job Orders",
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
    title: "12. Purchase Orders",
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
    title: "13. Invoices",
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
    title: "14. Personnel Management",
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
    title: "15. Time Tracking",
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
    title: "16. Payroll",
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
    title: "17. Vendor & Subcontractor Management",
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
    title: "18. Document Management",
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
    title: "19. QuickBooks Integration",
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
    title: "20. Reports & Analytics",
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
    title: "21. Administrative Tools",
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
    title: "22. PDF Generation System",
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
  doc.text("Command X — Application Walkthrough", PDF_MARGIN, footerY);
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
  doc.text("Command X", pageWidth / 2, 35, { align: "center" });

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
    "This document provides a step-by-step guide on how to use Command X, including getting started, daily workflows by role, when to use each module, and best practices — followed by a comprehensive overview of every module, workflow, and feature in the system.",
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

        const bulletLines = doc.splitTextToSize(bullet, contentWidth - 15);
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
  const fileName = `Command_X_Walkthrough_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};
