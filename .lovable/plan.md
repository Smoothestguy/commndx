## Add Isolated W-9 Preview Route

Add a standalone admin-only route that renders the W-9 form components with sample data so you can review the W-9 without walking through the full onboarding flow.

### New route
`/admin/preview/w9` — renders a page with two tabs:
1. **Onboarding W-9 (blank/fillable)** — the `W9TaxForm` component from `src/components/personnel/onboarding/`, prefilled with sample "Jane Doe" personnel data, using local React state (no DB writes).
2. **Completed W-9 (review view)** — the `W9FormPreview` component, fed a mock completed `W9Form` object showing the IRS-styled populated form.

Toggle buttons on the page switch between the two views. Nothing writes to the database.

### Wiring
- New file: `src/pages/admin/W9Preview.tsx`
- Register the route in `src/App.tsx` alongside other `/admin/*` routes, wrapped in the existing `ProtectedRoute` so only admins can access it.

### How you'd use it
Navigate to `/admin/preview/w9` in the preview to review the W-9 look/feel instantly — no token, no filling out prior steps.

No DB, RLS, or onboarding flow changes.
