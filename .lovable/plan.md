
# Plan: Fix Overlapping Text in Estimate PDF "Bill To" Section

## Problem

When generating a PDF for an estimate, the "Bill to" section shows overlapping text where the customer name, phone number, and email are printed on top of each other.

**Root Cause:** In `src/utils/estimatePdfExport.ts`, the `billToY` variable is not properly incremented after printing the customer name when there is no customer address. This causes the phone and email to be printed at the same Y position as the name.

## Current Code Flow (lines 183-210)

```typescript
// Line 186: Customer name printed
doc.text(estimate.customerName, margin + 5, billToY);

// Lines 189-197: Address handling (increments billToY only IF address exists)
if (estimate.customerAddress) {
  billToY += 5;  // <-- Only happens if address exists
  // ... address printing
}

// Lines 199-204: Phone (NO increment before printing!)
if (estimate.customerPhone) {
  doc.text(estimate.customerPhone, margin + 5, billToY);  // Same Y as name!
  billToY += 4;
}

// Lines 206-210: Email (if no phone, same position as name!)
if (estimate.customerEmail) {
  doc.text(estimate.customerEmail, margin + 5, billToY);
}
```

**When customer has NO address:** Name, phone, and email all print at `billToY` position, causing overlap.

## Solution

Add a `billToY += 5` increment immediately after printing the customer name, so subsequent fields always start on a new line.

## File to Modify

| File | Change |
|------|--------|
| `src/utils/estimatePdfExport.ts` | Add line increment after customer name (line 186) |

## Code Change

```typescript
// Customer name
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text(estimate.customerName, margin + 5, billToY);
billToY += 5;  // <-- ADD THIS LINE to move to next row

// Customer address (if available)
if (estimate.customerAddress) {
  doc.setTextColor(75, 85, 99);
  const addressLines = doc.splitTextToSize(estimate.customerAddress, halfWidth - 15);
  addressLines.slice(0, 2).forEach((line: string) => {
    doc.text(line, margin + 5, billToY);
    billToY += 4;
  });
}

// Customer phone
if (estimate.customerPhone) {
  doc.setTextColor(75, 85, 99);
  doc.text(estimate.customerPhone, margin + 5, billToY);
  billToY += 4;
}

// Customer email
if (estimate.customerEmail) {
  doc.setTextColor(75, 85, 99);
  doc.text(estimate.customerEmail, margin + 5, billToY);
}
```

## Expected Result

After the fix, the "Bill to" section will display properly:

```text
Bill to
4 Eighty
713-894-6405
4eighty@headwaycapital.us
```

Each field will be on its own line with proper spacing.
