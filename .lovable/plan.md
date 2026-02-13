

## Download Application Walkthrough as PDF

### Overview
Create a new utility function that generates a comprehensive, professionally formatted PDF document covering the entire Fairfield Construction Management ERP system -- all modules, workflows, and features -- using the existing `jsPDF` and `pdfHelpers` infrastructure. A button will be added to trigger the download.

### New File: `src/utils/appWalkthroughPdf.ts`

A standalone function `generateAppWalkthroughPDF()` that builds a multi-page PDF covering every section from the walkthrough:

1. **Cover Page** -- Title "Fairfield Construction Management ERP", subtitle "Complete Application Walkthrough", generation date, company branding using `drawDocumentHeader`
2. **Table of Contents** -- Numbered section list with page references
3. **Sections** (each using `checkAddPage` for proper pagination):
   - System Architecture and Layout (3-panel layout, role-based access)
   - Authentication and User Management (login, roles: Admin/Manager/User)
   - Dashboard and Navigation (sidebar, quick actions, recent activity)
   - Customer Management (CRUD, contact info, project linking)
   - Project Hub (project creation, status tracking, milestones, financial summary)
   - Estimates (line items, PDF generation, approval workflow, convert to job order)
   - Job Orders (inline-editable table, drag reorder, margin calculations, status flow)
   - Purchase Orders (vendor selection, approval, receiving)
   - Invoices (generation from job orders, payment tracking, aging)
   - Personnel Management (assignments, rate brackets, assets, export)
   - Time Tracking (GPS geofencing, idle detection, approval workflow)
   - Payroll (WH-347 certified payroll, pay period management)
   - Vendor and Subcontractor Management (portals, compliance, W-9)
   - Document Management (file uploads, storage, organization)
   - QuickBooks Integration (bidirectional sync, mapping)
   - Reports and Analytics (project reports, financial summaries)
   - Administrative Tools (audit logs, recycle bin, entity merging, permissions)
   - PDF Generation System (estimates, invoices, work orders, W-9)

4. **Footer** on every page -- page numbers, generation timestamp, company branding

### Styling Approach
- Uses existing `PDF_COLORS`, `PDF_FONTS`, `PDF_MARGIN`, `setColor`, `drawSeparatorLine` from `pdfHelpers.ts`
- Section headers: bold, blue (`PDF_COLORS.primary`), 14pt
- Sub-sections: bold, black, 11pt
- Body text: normal, 10pt with `splitTextToSize` for wrapping
- Bullet points for feature lists with proper indentation
- Page breaks managed via `createPageBreakChecker`

### Trigger: Button in the Chat or a dedicated page

Add a simple helper component or use a toast action. The simplest approach: create a small component `AppWalkthroughDownload` with a single button that calls `generateAppWalkthroughPDF()` and triggers the browser download. This can be placed wherever makes sense (e.g., Settings page, Help section, or called directly from a command).

### Technical Details

```text
File structure:
src/utils/appWalkthroughPdf.ts    -- NEW: PDF generation logic (~300 lines)
src/components/AppWalkthroughDownload.tsx -- NEW: Simple button component

Pattern:
- Same pattern as generateProjectReportPDF() in pdfExport.ts
- Uses jsPDF directly (client-side, no edge function needed)
- Downloads immediately as "Fairfield_ERP_Walkthrough_YYYY-MM-DD.pdf"
```

The PDF will be a static reference document (not pulling live data) that describes all features, workflows, and capabilities of the system in detail -- essentially the walkthrough from the previous conversation formatted as a professional PDF.
