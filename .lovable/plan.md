

# Fix: Use QuickBooks' Existing Numbering Sequence (3329) Instead of INV-2600001

## Problem

Your QuickBooks invoices use plain sequential numbers: 3328, 3327, 3326, etc. But the `extractNextNumber` function forces a year-prefixed format (`INV-26XXXXX`). It filters for numbers starting with "INV-26", finds none (because QB uses "3328"), and starts a brand new sequence at "INV-2600001".

From the edge function logs:
```
Sample doc numbers from QB: ["3328", "3327", "3326", ...]
Found 0 numbers with prefix INV-26
No INV-26 numbers found, starting fresh sequence
Next invoice number: INV-2600001
```

## Solution

Rewrite `extractNextNumber` to detect the actual numbering format used in QuickBooks and continue that sequence. If QB uses plain numbers (3328), the next number should be 3329 -- not INV-2600001.

## Implementation

### File: `supabase/functions/quickbooks-get-next-number/index.ts`

Replace the `extractNextNumber` function with logic that:

1. First checks if any numbers match the year-prefixed format (e.g., `INV-26XXXXX`). If so, continue that sequence.
2. If no prefixed numbers exist, check for plain numeric sequences (e.g., `3328`). If found, increment the highest one (returns `3329`).
3. Only if no numbers exist at all, start a new prefixed sequence as fallback.

```text
extractNextNumber(docNumbers, prefix):
  1. Filter for year-prefixed numbers (e.g., "INV-26...")
     -> If found, increment highest and return (e.g., "INV-2600002")
  
  2. Filter for plain numeric numbers (e.g., "3328")
     -> If found, increment highest and return (e.g., "3329")
  
  3. Fallback: return "{prefix}{year}00001" (e.g., "INV-2600001")
```

### Key Logic Change

```typescript
function extractNextNumber(docNumbers: string[], prefix: string): string {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const yearPrefix = `${prefix}${currentYear}`;

  // Strategy 1: Check for year-prefixed numbers (INV-26XXXXX)
  const prefixedNumbers = docNumbers
    .filter(num => num && num.startsWith(yearPrefix))
    .map(num => parseInt(num.substring(yearPrefix.length), 10))
    .filter(n => !isNaN(n) && n > 0);

  if (prefixedNumbers.length > 0) {
    const max = Math.max(...prefixedNumbers);
    const padLen = Math.max(5, String(max).length);
    return `${yearPrefix}${(max + 1).toString().padStart(padLen, '0')}`;
  }

  // Strategy 2: Check for plain numeric numbers (3328, 3327, ...)
  const plainNumbers = docNumbers
    .filter(num => num && /^\d+$/.test(num))
    .map(num => parseInt(num, 10))
    .filter(n => !isNaN(n) && n > 0);

  if (plainNumbers.length > 0) {
    const max = Math.max(...plainNumbers);
    return String(max + 1);
  }

  // Strategy 3: No numbers found at all, start new sequence
  return `${yearPrefix}00001`;
}
```

## Result

| Before | After |
|--------|-------|
| QB has 3328, function returns INV-2600001 | QB has 3328, function returns 3329 |
| Ignores existing QB numbering | Respects existing QB numbering |
| All document types affected (invoices, bills, estimates, POs) | All document types fixed |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-get-next-number/index.ts` | Rewrite `extractNextNumber` to detect and continue existing numbering format |

No frontend changes needed.

