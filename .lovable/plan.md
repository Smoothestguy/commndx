
## Project Financial Dashboard Cleanup

Fix the double-counting issue in the Project Financial Summary and add margin color coding, negative profit alerts, and drill-down capability.

---

### Root Cause: Double-Counting

The current cost formula in `ProjectDetail.tsx` (line 211) is:

```
totalAllCosts = totalPOValue + totalLaborCost + totalOtherExpenses
```

Where:
- `totalPOValue` = sum of all PO face values (committed WO amounts to subs)
- `totalLaborCost` = time entry costs + personnel payment allocations + vendor labor bills
- `totalOtherExpenses` = non-labor vendor bill line items

The problem: **vendor bills are payments AGAINST POs**. So the same sub cost is counted twice -- once via the PO committed value (`totalPOValue`) and again via the vendor bill line items (`vendorLaborCost + vendorOtherTotal`). This causes inflated costs and false negative profit.

---

### Fix: Single Source of Truth Formula

**REVENUE:**
- Job Order totals (original contract)
- + Approved Change Orders (net additive/deductive)
- + Approved T&M Tickets (net)
- = **Total Contract Value**

**COSTS:**
- Work Order (PO) committed value + addendums (what we owe subs) -- this already includes all sub costs
- + Internal Labor (time entry costs only -- direct hours x rate from time tracking)
- + Other Expenses (non-PO expenses from `personnel_payment_allocations` only, NOT vendor bill line items which are PO payments)
- = **Total Costs**

**PROFIT** = Revenue - Costs
**MARGIN** = Profit / Revenue x 100

The key change: **remove vendor bill line item totals from the cost calculation** since they represent payments against POs already counted via `totalPOValue`. Personnel payment allocations stay if they represent non-PO labor costs (payroll).

---

### Changes

#### 1. Fix Cost Calculation in `ProjectDetail.tsx`

Modify the `financialData` useMemo (lines 167-234):
- Remove `vendorLaborCost` and `vendorOtherTotal` from cost calculation
- Keep `totalPOValue` as the sub cost source (WO committed value)
- Keep `timeEntryLaborCost` as internal labor (supervision + field)
- Keep `personnelPaymentCost` as additional labor cost (payroll allocations not tied to POs)
- `totalOtherExpenses` = personnel payments only (not vendor bills)
- Add `totalSubCost` field (= totalPOValue) for clarity in display

Updated formula:
```
totalCosts = totalPOValue + timeEntryLaborCost + personnelPaymentCost
netProfit = totalContractValue - totalCosts
```

#### 2. Redesign Financial Summary Display in `ProjectFinancialSummary.tsx`

Replace the current layout with clear stat cards at top:

**Top cards row (color-coded):**
- Contract Value (original JO total)
- Change Orders (net)
- Total Contract Value
- WO Costs (sub commitments)
- Internal Labor
- Total Costs
- Net Profit
- Margin % -- color: green if > 30%, yellow if 15-30%, red if < 15%

**Negative profit alert:**
- Red banner when `netProfit < 0`: "This project is currently showing a loss of $X. Review costs and billing."

**Supervision impact section** (existing, keep as-is)

**Progress bars** (existing, keep as-is)

#### 3. Add Drill-Down Capability

Add collapsible detail sections under each summary card:
- "WO Costs" expands to show each PO with number, vendor, and amount
- "Internal Labor" expands to show personnel breakdown from time entries
- "Contract Value" expands to show each JO
- "Change Orders" expands to show each approved CO

This uses existing list components already on the page (`ProjectPurchaseOrdersList`, `ProjectChangeOrdersList`, etc.) -- the drill-down links will scroll to or navigate to those sections.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/ProjectDetail.tsx` | Fix `financialData` cost calculation to remove vendor bill double-counting; pass additional drill-down data |
| `src/components/project-hub/ProjectFinancialSummary.tsx` | Redesign with stat cards, margin color coding, negative profit alert, drill-down links |

### Files NOT Modified

- No database changes
- No hook changes (data sources remain the same, just used differently)
- No changes to existing list components

### Technical Details

**Cost formula change (ProjectDetail.tsx lines 196-213):**

Before:
```typescript
const totalLaborCost = timeEntryLaborCost + personnelPaymentCost + vendorLaborCost;
const totalOtherExpenses = projectExpenses?.vendor_other_total || 0;
const totalAllCosts = totalPOValue + totalLaborCost + totalOtherExpenses;
```

After:
```typescript
const totalLaborCost = timeEntryLaborCost + personnelPaymentCost;
const totalOtherExpenses = 0; // Vendor bills are PO payments, not separate expenses
const totalAllCosts = totalPOValue + totalLaborCost;
```

**Margin color coding logic:**
```typescript
const marginColor = netMargin >= 30 ? 'text-green-500' 
  : netMargin >= 15 ? 'text-yellow-500' 
  : 'text-red-500';
```

**Negative profit alert:**
```tsx
{data.netProfit < 0 && (
  <Alert variant="destructive">
    <AlertTitle>Project Loss Alert</AlertTitle>
    <AlertDescription>
      This project is currently showing a loss of {formatCurrency(Math.abs(data.netProfit))}. 
      Review costs and billing.
    </AlertDescription>
  </Alert>
)}
```
