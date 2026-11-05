# Kiosk privacy, badges and agency hiring

## Build
- Default kiosk links and QR posters to **Search**, with manager-selectable Search / Roster / Badge modes encoded in the URL. Search reveals only limited matching names; a profile photo appears only after selection.
- Require a selfie and signature for Search/Roster check-in, preserve checkout confirmation, early-arrival reasons, geofence overrides, retry safety, and automatic return. Badge mode provides a camera scanner with the same punch safeguards.
- Add manager-only badge issuance, replacement/revocation, individual card PDFs and project bulk printing. Add supervisor badge scanning in Field Mode.
- Add vendor hiring links using existing public postings and agency tokens, server-side applicant attribution, applicant agency chips, and agency carry-forward during personnel conversion.

## Security and assumptions
- **No migrations**, no anonymous table access, and no cron activation.
- Selfie verification means captured evidence for supervisor review, **not automated facial recognition**.
- Store selfie/signature evidence privately. The existing `field-captures` bucket has previously been public; use private `project-documents` paths unless its privacy can be safely confirmed without affecting existing media.
- Field Mode scanning retains authenticated server punch enforcement rather than direct inserts that bypass geofences, shift rules, signatures, or sheet locks.
- Agency attribution must be bound to a validated submission, not an unauthenticated arbitrary applicant-ID update. Preserve existing duplicate-linking behavior.

## Technical details
- Regenerate live types; dynamically import a proven QR scanner and the existing PDF/QR libraries.
- Extend token-validated edge functions for limited kiosk search, selected profile photo, badge punching and the requested `document-sign` `kiosk_media` action; use existing live RPCs and active-roster validation.
- Reuse the existing signature pad and manager permission checks; keep immutable evidence and signature/media-only retries separate from accepted punches.

## Verification
- Test URL-mode defaults, badge payload parsing, search limits, manager access, active/expired tokens, private-media roster scoping, and agency attribution rules.
- Exercise kiosk selection → selfie/signature → punch → evidence readback, badge printing/scanning, and an agency application through conversion with isolated fixtures where available.
- Check phone/tablet layouts and run `bunx tsgo --noEmit` plus focused tests. Report actual-device or live-server limitations explicitly.