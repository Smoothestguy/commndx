
# Plan: Fix Personnel Status Filter Dropdown Not Displaying Options

## Problem Identified

The `SelectContent` component in `src/components/ui/select.tsx` has an incorrect CSS class on the viewport that constrains its height to match the trigger button height:

```tsx
// Current (BROKEN)
"h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
```

This means:
- Trigger button height: ~44px
- Dropdown viewport height: ~44px (same as trigger!)
- Result: Only 1 option visible, or content gets clipped/hidden

This affects ALL Select dropdowns across the application, including the Personnel status filter.

---

## Solution

Fix the `SelectPrimitive.Viewport` className in `src/components/ui/select.tsx` by removing the height constraint and only keeping the width constraint:

```tsx
// Fixed
"w-full min-w-[var(--radix-select-trigger-width)]"
```

---

## Technical Details

**File to modify:** `src/components/ui/select.tsx`

**Line 79-84 (Current):**
```tsx
<SelectPrimitive.Viewport
  className={cn(
    "p-1",
    position === "popper" &&
      "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
  )}
>
```

**Line 79-84 (Fixed):**
```tsx
<SelectPrimitive.Viewport
  className={cn(
    "p-1",
    position === "popper" &&
      "w-full min-w-[var(--radix-select-trigger-width)]",
  )}
>
```

---

## Impact

This fix will restore proper dropdown behavior for:
- Personnel status filter (Active/Inactive/DNH)
- E-Verify status filter
- Vendor filter
- All other Select components throughout the application

---

## Root Cause

The `h-[var(--radix-select-trigger-height)]` CSS variable sets a fixed height equal to the trigger button. This is incorrect because:
1. The viewport should expand to fit its content
2. The `max-h-96` on the parent `SelectContent` already limits maximum height
3. Setting a fixed height collapses the dropdown to an unusable size
