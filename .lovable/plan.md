# Fix: Home ZIP (and Phone) "Required" not reflected on form

## Problem

In the Form Template builder, the Core Fields card lists Phone and Home ZIP Code with `canBeRequired: true`, but the UI only ever renders a "Required" sub-toggle for **Profile Picture** (`src/components/form-builder/CoreFieldsCard.tsx:81`, hard-coded `field.key === "profilePicture"`).

As a result:
- There's no way to mark Home ZIP or Phone as required from the builder.
- The public form (`src/pages/PublicApplicationForm.tsx:1263-1286`) renders Home ZIP with a plain `<FormLabel>Home ZIP Code</FormLabel>` (no asterisk, no zod requirement).
- The Live Preview (`src/components/form-builder/FormPreview.tsx:428-433`) also shows no asterisk.

The user's "toggle on" only enables the field — it does not mark it required — so the discrepancy they see is by design but not by expectation.

## Fix (scope: form builder + preview + public form)

1. **Settings shape** — extend `FormSettings` in `src/integrations/supabase/hooks/useApplicationFormTemplates.ts` with two optional flags:
   - `requirePhone?: boolean` (default false)
   - `requireHomeZip?: boolean` (default false)

2. **Builder UI** — in `src/components/form-builder/CoreFieldsCard.tsx`:
   - Generalize `showRequiredToggle` so it renders for any `canBeRequired` core field that is enabled (Profile Picture, Phone, Home ZIP), not just Profile Picture.
   - Extend `handleRequiredToggle` and `isFieldRequired` to read/write `settings.requirePhone` and `settings.requireHomeZip`.
   - Keep Profile Picture's existing default-to-required-on-enable behavior; Phone and Home ZIP default to NOT required on enable (backward compatible).

3. **Live Preview** — in `src/components/form-builder/FormPreview.tsx`:
   - Accept `settings` (or just the two new flags) via props.
   - Show `Phone *` / `Phone` and `Home ZIP Code *` / `Home ZIP Code` based on the flags.
   - Pass the settings through from `LiveFormPreview.tsx` and any full-preview caller.

4. **Public form** — in `src/pages/PublicApplicationForm.tsx`:
   - Update the zod schema builder so `phone` and `home_zip` become required strings when `formSettings.requirePhone` / `requireHomeZip` is true (currently phone is already required via existing logic — verify and keep; home_zip becomes conditionally required with a "Home ZIP Code is required" message and a 5-digit format check when required).
   - Update the rendered labels to append ` *` when required.

5. **Settings persistence** — no DB migration needed; `settings` is JSONB and already round-trips through `useUpdateApplicationFormTemplate`.

## Out of scope
- No changes to routing, RPCs, or the applications table.
- No changes to headcount enforcement or other Core fields.
- No visual redesign — reuses the exact Profile Picture "Required" toggle pattern shown in the screenshot.

## Verification
- Build passes (tsgo).
- Toggle Home ZIP → Required in the builder → asterisk appears in Live Preview and on the public form; submitting without a ZIP shows a validation error.
- Existing templates with no `requireHomeZip`/`requirePhone` continue to render Home ZIP as optional (no behavior change).
