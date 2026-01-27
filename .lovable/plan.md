
# Add Copyright Page

## Overview
Create a dedicated Copyright page that provides comprehensive intellectual property notices, ownership information, and trademark details for Fairfield/Command X.

## Implementation

### 1. Create Copyright Page Component
**File:** `src/pages/legal/Copyright.tsx`

Create a new legal page following the existing pattern (EULA, TermsOfService, PrivacyPolicy) with:
- SEO component with title "Copyright Notice"
- Consistent styling with other legal pages
- Sections covering:
  1. **Copyright Ownership** - Statement of copyright ownership by Fairfield
  2. **All Rights Reserved** - Standard copyright notice with current year
  3. **Trademarks** - Command X, Fairfield trademarks and logos
  4. **Permitted Uses** - What users can and cannot do with content
  5. **User-Generated Content** - Ownership of content users create
  6. **Third-Party Content** - Attribution and third-party rights
  7. **DMCA / Takedown Requests** - How to report copyright infringement
  8. **Contact Information** - admin@fairfieldrg.com for inquiries

### 2. Add Route to App.tsx
Add the route alongside the other legal pages:
```tsx
import Copyright from "./pages/legal/Copyright";
// ...
<Route path="/legal/copyright" element={<Copyright />} />
```

### 3. Cross-Link from Other Legal Pages (Optional Enhancement)
Add footer links in other legal pages to reference the new Copyright page for comprehensive coverage.

## File Changes Summary
| File | Action |
|------|--------|
| `src/pages/legal/Copyright.tsx` | Create new file |
| `src/App.tsx` | Add import and route |

## Result
The Copyright page will be accessible at `/legal/copyright` with full SEO support and consistent styling matching your other legal documents.
