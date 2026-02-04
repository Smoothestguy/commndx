

# Remove Unit Price from Estimate PDF

## Overview

Hide the unit price column from the estimate PDF document to show only Description, Quantity, and Amount (total per line).

---

## Current Layout

```text
┌──────────────────────────────────────────────────────────┐
│ Description          │ Qty │ Unit Price │ Amount        │
├──────────────────────────────────────────────────────────┤
│ Product Name         │  5  │   $100.00  │   $500.00     │
│ Another Item         │  2  │    $50.00  │   $100.00     │
└──────────────────────────────────────────────────────────┘
```

## New Layout (After Change)

```text
┌──────────────────────────────────────────────────────────┐
│ Description                           │ Qty │ Amount    │
├──────────────────────────────────────────────────────────┤
│ Product Name                          │  5  │   $500.00 │
│ Another Item                          │  2  │   $100.00 │
└──────────────────────────────────────────────────────────┘
```

---

## File to Modify

| File | Changes |
|------|---------|
| `src/utils/estimatePdfExport.ts` | Remove Unit Price column header and values, adjust column positions |

---

## Implementation Details

### Changes to `src/utils/estimatePdfExport.ts`

**1. Remove Unit Price column header (line 309)**

Current:
```typescript
doc.text("Description", margin + 5, yPos + 7);
doc.text("Qty", pageWidth - 90, yPos + 7);
doc.text("Unit Price", pageWidth - 65, yPos + 7);  // Remove this
doc.text("Amount", pageWidth - margin - 5, yPos + 7, { align: "right" });
```

Updated:
```typescript
doc.text("Description", margin + 5, yPos + 7);
doc.text("Qty", pageWidth - 55, yPos + 7);  // Adjust position
doc.text("Amount", pageWidth - margin - 5, yPos + 7, { align: "right" });
```

**2. Remove Unit Price from line items (line 346)**

Current:
```typescript
doc.text(line, margin + 5, yPos);
doc.setFont("helvetica", "normal");
doc.text(item.quantity.toString(), pageWidth - 90, yPos);
doc.text(formatCurrencyForPDF(item.unitPrice), pageWidth - 65, yPos);  // Remove this
doc.text(formatCurrencyForPDF(item.total), pageWidth - margin - 5, yPos, { align: "right" });
```

Updated:
```typescript
doc.text(line, margin + 5, yPos);
doc.setFont("helvetica", "normal");
doc.text(item.quantity.toString(), pageWidth - 55, yPos);  // Adjust position
doc.text(formatCurrencyForPDF(item.total), pageWidth - margin - 5, yPos, { align: "right" });
```

**3. Adjust description max width**

Current:
```typescript
const maxDescWidth = pageWidth - 120;
```

Updated (wider description area since unit price column is removed):
```typescript
const maxDescWidth = pageWidth - 90;
```

---

## Summary of Changes

| Line(s) | Change |
|---------|--------|
| 309 | Remove "Unit Price" header, adjust "Qty" position from -90 to -55 |
| 331 | Increase maxDescWidth from 120 to 90 |
| 345-346 | Remove unit price line, adjust quantity position from -90 to -55 |

---

## Expected Result

After this change, the estimate PDF will display:
- **Description** - Product/service name with details
- **Qty** - Quantity ordered  
- **Amount** - Total price for the line item (quantity × unit price)

The unit price will be hidden from the customer-facing PDF while still being tracked internally in the system.

