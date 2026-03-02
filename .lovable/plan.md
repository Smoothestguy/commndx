

## Fix: Vendor Banking Tab — Authorization Status Shows "Not Signed" Despite Signed Forms

### Problem
On the Vendor Detail Banking tab (e.g., Yicel Alcala), the Direct Deposit card's "Authorization Status" always shows **"Not Signed"** because `signature={null}` and `signedAt={null}` are hardcoded on lines 733-734 of `VendorDetail.tsx`. The vendor *does* have a `vendor_agreement_signature` that serves as banking authorization, but it's not being passed through.

### Fix
In `src/pages/VendorDetail.tsx`, change the `DirectDepositView` props from:
```tsx
signature={null}
signedAt={null}
```
to:
```tsx
signature={vendor.vendor_agreement_signature}
signedAt={vendor.vendor_agreement_signed_at}
```

This single change will make the Authorization Status section show "Authorization Signed" with the signature image, date, and "View Full Form" button — matching how Personnel displays it.

### Files
| File | Change |
|------|--------|
| `src/pages/VendorDetail.tsx` | Pass vendor agreement signature to DirectDepositView instead of null |

