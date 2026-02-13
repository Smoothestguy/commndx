

## Add "How to Use Command X" Step-by-Step Guide to Walkthrough PDF

### Overview
Add a new introductory section (before the current 18 modules) to the walkthrough PDF that provides a practical, step-by-step guide on **how to use Command X** -- what it is, when to use each module, and the typical daily/weekly workflows for different roles.

### Changes to `src/utils/appWalkthroughPdf.ts`

Insert new sections into the `SECTIONS` array at the beginning, shifting existing section numbers up. The new content will cover:

**New Section: "Getting Started with Command X"**
- What Command X is (construction management ERP for Fairfield Group)
- How to log in and set up your profile
- Understanding the interface layout (sidebar, main area, detail pane)
- Keyboard shortcuts (Cmd+K search, Cmd+Shift+P portal switcher)

**New Section: "Step-by-Step Daily Workflows"**
- **For Field Workers**: Clock in with GPS, log time to project, submit for approval
- **For Project Managers**: Review dashboard, approve time entries, check project financials, generate invoices
- **For Admins**: Manage users, review audit logs, run payroll, handle vendor compliance
- **For Office Staff**: Create estimates, manage customers, process vendor bills, generate POs

**New Section: "When to Use Each Module"**
- A guide mapping business scenarios to the right module (e.g., "New client inquiry? Go to Customers", "Need materials? Create a Purchase Order", "Worker needs to get paid? Go to Payroll")
- Common task flows: Estimate-to-Invoice lifecycle, Hire-to-Payroll lifecycle, PO-to-Payment lifecycle

**New Section: "Tips, Shortcuts & Best Practices"**
- Search and navigation tips
- PDF generation and export tips
- Data entry best practices
- Common pitfalls and how to avoid them

### Technical Details

- Add 4 new `Section` objects to the beginning of the `SECTIONS` array (before "System Architecture")
- Renumber all existing sections from 5-22 (instead of 1-18)
- Update the cover page description text to mention the step-by-step guide
- Update the section count display on cover page (will auto-update since it uses `SECTIONS.length`)
- No new files needed -- all changes in `src/utils/appWalkthroughPdf.ts`

