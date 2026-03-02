

## Plan: Enhance Vendor Detail — Dedicated Banking & Documents Sections

### Current State

The VendorDetail page already displays banking info (bank name, account type, routing/account numbers with Eye toggle masking) and documents, but they're buried:
- **Banking** is embedded within the large "Financial Information" card alongside tax, billing, signatures, and work authorization fields
- **Documents** are only shown in the Documents tab via `VendorDocumentUpload`, which is a basic upload/list component without preview capability

### What To Change

**1. Extract Banking into a dedicated Card** (between Financial Info and Notes cards)
- Separate `CreditCard`-icon Card titled "Banking Information"
- Fields: Bank Name, Account Type, Routing Number (masked with Eye toggle), Account Number (masked with Eye toggle)
- Show W-9 signature date and Vendor Agreement signature date
- Remove these fields from the Financial Information card to avoid duplication

**2. Add a dedicated "Banking" tab** to the tabs section (alongside Personnel, POs, Bills, Documents)
- Reuse the same banking card content plus work authorization details (citizenship, immigration, ITIN)
- Add signature previews if available (W-9 signature image, vendor agreement signature image)

**3. Upgrade the Documents tab** to match PersonnelDocumentsList quality
- Create `VendorDocumentsList.tsx` component modeled after `PersonnelDocumentsList`
- Add preview dialog (image inline, PDF in iframe, fallback download prompt)
- Add "Download All" button
- Add delete confirmation dialog (currently uses raw `confirm()`)
- Keep the upload form at the top, document list below with improved styling
- Show expiry status with color coding (red for expired)

### Files to Create/Edit

| File | Change |
|------|--------|
| `src/components/vendors/VendorDocumentsList.tsx` | New — document list with preview/download-all/delete-confirm, modeled after PersonnelDocumentsList |
| `src/pages/VendorDetail.tsx` | Extract banking into dedicated Card; add Banking tab; replace `VendorDocumentUpload` list portion with `VendorDocumentsList`; keep upload form |
| `src/components/vendors/VendorDocumentUpload.tsx` | Simplify to upload-only (the list display moves to VendorDocumentsList) |

### Technical Details

- Vendor documents use public URLs via `getPublicUrl` (per memory context), so no signed URL needed — direct `window.open` for preview/download
- Banking fields already exist on the `vendors` table — no database changes needed
- The reveal/mask toggle pattern (`revealedFields` state + Eye/EyeOff) is already implemented in VendorDetail and will be reused in the new Banking card
- The new VendorDocumentsList will adapt PersonnelDocumentsList patterns but use `VendorDocument` type (which has `document_url` instead of `file_path`, and `document_name` instead of `file_name`)

