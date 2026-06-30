## Plan: Dump all portal code in chat

You asked for every portal file (pages + components + hooks + edge functions) pasted inline. That is **~55 files / ~15,000+ lines**, which will not fit in a single response. I'll deliver it across multiple sequential messages (no code changes — read-only dump).

### Files I'll paste (grouped by batch)

**Batch 1 — Personnel Portal pages (13 files)**
`src/pages/portal/`: AcceptPortalInvitation, PortalLogin, PortalDashboard, PortalProjects, PortalProjectDetail, PortalTimeClock, PortalHours, PortalAssets, PortalDocuments, PortalReimbursements, PortalTaxForms, PortalNotifications, PortalSettings

**Batch 2 — Personnel Portal components (12 files)**
`src/components/portal/`: PortalLayout, PortalProtectedRoute, PhotoUploadRequired, ClockInModal, ClockStatusCard, ClockHistoryTable, InlineClockControls, ProjectClockCard, ProjectWeeklyPayHistory, LocationPermissionDialog, PortalAssetCard, ReceiptUpload

**Batch 3 — Vendor Portal (11 files)**
Pages: AcceptVendorInvitation, VendorLogin, VendorDashboard, VendorPOsList, VendorPODetail, VendorBillsList, VendorBillDetail, VendorNewBill, VendorSettings
Components: VendorPortalLayout, VendorProtectedRoute

**Batch 4 — Subcontractor Portal (13 files)**
Pages: SubcontractorLogin, SubcontractorDashboard, SubcontractorPOList, SubcontractorPODetail, SubcontractorBillsList, SubcontractorBillDetail, SubcontractorNewBill, SubcontractorCompletions, SubcontractorCompletionDetail, SubcontractorCompletionHistory
Components: SubcontractorPortalLayout, SubcontractorProtectedRoute, POBackChargesDisplay

**Batch 5 — Portal hooks (6 files)**
`src/integrations/supabase/hooks/`: usePortal.ts, usePortalAssets.ts, useVendorPortal.ts, useSubcontractorPortal.ts, useTimeClock.ts, useVendorOnboarding.ts

**Batch 6 — Edge functions (5 files)**
`supabase/functions/`: accept-portal-invitation, accept-vendor-invitation, send-portal-invitation, send-vendor-portal-invitation, notify-invitation-accepted

### Notes
- I'll paste each file with its full path as a header and a fenced code block.
- No edits — read-only export.
- If you'd rather have it as a **single downloadable markdown file** in the project (e.g., `docs/portal-code-dump.md`), say so and I'll switch — that's far more practical than 6 long chat messages.

Approve to start with Batch 1, or tell me to switch to the single-file export instead.