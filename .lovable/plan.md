

# Mobile Optimization for AI Assistant Inline Forms

## Overview
Enhance the EstimateFormInline, InvoiceFormInline, and LineItemBuilder components to provide a better mobile experience with proper touch targets, responsive layouts, and improved visibility.

---

## Issues to Address

| Issue | Current | Improved |
|-------|---------|----------|
| Delete button size | 24x24px (`h-6 w-6`) | 40x40px on mobile for easier touch |
| Line item layout | Single row for Qty/Price/Total | Stacked layout on mobile |
| Message container | Fixed `max-w-[80%]` | Wider on mobile to fit forms |
| Input heights | 32px (`h-8`) | 40px on mobile for touch targets |
| Total display | Fixed `w-16` inline | Full width row on mobile |
| Add Item button | 32px height | 44px on mobile |
| Submit button | Standard height | 48px on mobile |

---

## Technical Changes

### 1. LineItemBuilder.tsx - Responsive Line Items

**Stack Qty/Price inputs on narrow screens:**
```tsx
// Current: flex gap-2 (always horizontal)
<div className="flex gap-2">
  <div className="flex-1">Qty</div>
  <div className="flex-1">Price</div>
  <div className="w-16">Total</div>
</div>

// Improved: Grid that stacks on mobile
<div className="grid grid-cols-2 gap-2">
  <div>
    <label>Qty</label>
    <Input className="h-10" /> {/* Larger touch target */}
  </div>
  <div>
    <label>Price</label>
    <Input className="h-10" />
  </div>
</div>
<div className="text-right text-sm font-medium pt-1">
  Line Total: $XX.XX
</div>
```

**Larger delete button:**
```tsx
// Current
<Button className="h-6 w-6">

// Improved
<Button className="h-8 w-8 sm:h-6 sm:w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0">
```

**Larger Add Item button:**
```tsx
// Current
<Button className="w-full h-8 text-xs">

// Improved  
<Button className="w-full h-10 text-sm">
```

### 2. ChatMessage.tsx - Wider Forms on Mobile

```tsx
// Current: max-w-[80%] - forms get cramped
<div className="max-w-[80%] rounded-2xl px-4 py-2.5">

// Improved: Full width when showing forms
<div className={cn(
  "rounded-2xl px-4 py-2.5",
  message.formRequest 
    ? "max-w-full w-full" 
    : "max-w-[80%]",
  isUser ? "..." : "..."
)}>
```

### 3. EstimateFormInline.tsx & InvoiceFormInline.tsx

**Larger submit button:**
```tsx
// Current
<Button className="w-full">

// Improved
<Button className="w-full h-11 text-base font-medium">
```

**Larger select trigger:**
```tsx
// Current
<SelectTrigger className="h-9 text-sm">

// Improved
<SelectTrigger className="h-10 text-sm">
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ai-assistant/forms/LineItemBuilder.tsx` | Grid layout for inputs, larger buttons, better spacing |
| `src/components/ai-assistant/forms/EstimateFormInline.tsx` | Larger submit button, improved select height |
| `src/components/ai-assistant/forms/InvoiceFormInline.tsx` | Same as EstimateFormInline |
| `src/components/ai-assistant/ChatMessage.tsx` | Full-width messages when showing forms |

---

## Visual Comparison

**Before (mobile):**
```
┌──────────────────────────┐
│ Select product...    [x] │
│ [Qty: 1] [Price: 0] $0   │  ← Cramped
└──────────────────────────┘
```

**After (mobile):**
```
┌────────────────────────────────┐
│ Select product...          [x] │
│ ┌─────────┐  ┌───────────────┐ │
│ │ Qty: 1  │  │ Price: $0.00  │ │
│ └─────────┘  └───────────────┘ │
│              Line Total: $0.00 │
└────────────────────────────────┘
```

---

## Summary

- Use 2-column grid for Qty/Price instead of cramped 3-column flex
- Move line total to its own row for clarity
- Increase all touch targets to 40-44px minimum
- Make form messages full-width to give forms room to breathe
- Use larger font sizes on mobile submit buttons

