

# Create Demo Accounts for Apple App Store Review

## Overview

Set up dedicated demo accounts with pre-populated data so Apple reviewers can fully test both the Personnel Portal and Vendor Portal without accessing real employee/vendor data.

---

## Accounts to Create

| Portal | Demo Email | Purpose |
|--------|------------|---------|
| Personnel | `apple.review.personnel@fairfieldgp.com` | Demo field worker account |
| Vendor | `apple.review.vendor@fairfieldgp.com` | Demo subcontractor account |

---

## Step 1: Create Demo Personnel Record

Insert a demo personnel record with realistic profile data:

```sql
INSERT INTO personnel (
  first_name, 
  last_name, 
  email, 
  phone, 
  status, 
  hourly_rate,
  address,
  city,
  state,
  zip,
  photo_url,
  onboarding_status
) VALUES (
  'Alex',
  'Demo',
  'apple.review.personnel@fairfieldgp.com',
  '555-0100',
  'active',
  25.00,
  '123 Demo Street',
  'Houston',
  'TX',
  '77001',
  'https://ui-avatars.com/api/?name=Alex+Demo&background=3b82f6&color=fff&size=200',
  'completed'
);
```

---

## Step 2: Assign Demo Personnel to Active Project

```sql
INSERT INTO personnel_project_assignments (
  personnel_id, 
  project_id, 
  status,
  assigned_at,
  pay_rate,
  bill_rate
)
SELECT 
  p.id,
  '9beca945-fabe-4042-86b1-5ed0323b9e4e', -- ONE OAK CONDOMINIUM (active project)
  'active',
  NOW(),
  25.00,
  45.00
FROM personnel p 
WHERE p.email = 'apple.review.personnel@fairfieldgp.com';
```

---

## Step 3: Add Demo Time Entries (Past 2 Weeks)

Create realistic time entries for the demo personnel:

```sql
INSERT INTO time_entries (
  personnel_id, 
  project_id, 
  entry_date, 
  regular_hours, 
  overtime_hours, 
  description,
  status,
  billable
)
SELECT 
  p.id,
  ppa.project_id,
  (CURRENT_DATE - (n || ' days')::interval)::date,
  8,
  CASE WHEN n % 4 = 0 THEN 2 ELSE 0 END,
  CASE 
    WHEN n % 5 = 0 THEN 'Drywall installation'
    WHEN n % 5 = 1 THEN 'Framing work'
    WHEN n % 5 = 2 THEN 'Material staging'
    WHEN n % 5 = 3 THEN 'Interior finishing'
    ELSE 'General labor'
  END,
  'approved',
  true
FROM personnel p
JOIN personnel_project_assignments ppa ON ppa.personnel_id = p.id
CROSS JOIN generate_series(1, 14) n
WHERE p.email = 'apple.review.personnel@fairfieldgp.com'
  AND EXTRACT(DOW FROM CURRENT_DATE - (n || ' days')::interval) BETWEEN 1 AND 5;
```

---

## Step 4: Create Demo Vendor Record

```sql
INSERT INTO vendors (
  name,
  email,
  phone,
  company,
  specialty,
  status,
  vendor_type,
  address,
  city,
  state,
  zip,
  onboarding_status,
  w9_on_file
) VALUES (
  'Demo Subcontractor',
  'apple.review.vendor@fairfieldgp.com',
  '555-0200',
  'Demo Construction Co',
  'General Contracting',
  'active',
  'subcontractor',
  '456 Contractor Ave',
  'Houston',
  'TX',
  '77002',
  'completed',
  true
);
```

---

## Step 5: Create Purchase Order for Demo Vendor

```sql
INSERT INTO purchase_orders (
  vendor_id,
  vendor_name,
  project_id,
  project_name,
  status,
  subtotal,
  total,
  notes,
  due_date
)
SELECT 
  v.id,
  v.name,
  '9beca945-fabe-4042-86b1-5ed0323b9e4e',
  'ONE OAK CONDOMINIUM',
  'sent',
  7500.00,
  7500.00,
  'Demo purchase order for app review',
  CURRENT_DATE + INTERVAL '30 days'
FROM vendors v 
WHERE v.email = 'apple.review.vendor@fairfieldgp.com';
```

---

## Step 6: Create Vendor Bill for Demo Vendor

```sql
INSERT INTO vendor_bills (
  vendor_id,
  vendor_name,
  purchase_order_id,
  bill_date,
  due_date,
  status,
  subtotal,
  total,
  paid_amount,
  remaining_amount,
  notes,
  submitted_by_vendor
)
SELECT 
  v.id,
  v.name,
  po.id,
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '23 days',
  'open',
  2500.00,
  2500.00,
  0,
  2500.00,
  'Progress billing - Phase 1 completion',
  true
FROM vendors v
JOIN purchase_orders po ON po.vendor_id = v.id
WHERE v.email = 'apple.review.vendor@fairfieldgp.com';
```

---

## Step 7: Create Auth Users

Create authentication users for both demo accounts. This needs to be done via the authentication system.

**Option A: Manual Email/Password Setup**

Use the app's sign-up flow or backend auth admin to create users with:

| Email | Password (your choice) |
|-------|------------------------|
| `apple.review.personnel@fairfieldgp.com` | `AppleReview2024!` |
| `apple.review.vendor@fairfieldgp.com` | `AppleReview2024!` |

**Option B: Via Backend Auth Admin**

If you have access to the backend authentication panel, create users there with the above credentials.

---

## What to Submit to Apple in App Store Connect

### App Review Information Section

**Demo Account 1 - Personnel Portal:**
```
Username: apple.review.personnel@fairfieldgp.com
Password: AppleReview2024!
```

**Demo Account 2 - Vendor Portal:**
```
Username: apple.review.vendor@fairfieldgp.com
Password: AppleReview2024!
```

**Review Notes:**
```
PERSONNEL PORTAL ACCESS:
1. Launch the app
2. You'll see the Personnel Portal login screen
3. Enter the Personnel demo credentials using email/password
4. Features available: Dashboard, Time Clock, Hours History, Projects, 
   Reimbursements, Documents, Tax Forms, Settings

VENDOR PORTAL ACCESS:
1. Launch the app
2. Tap "Switch Portal" button at the bottom of the login screen
3. Select "Vendor Portal"
4. Enter the Vendor demo credentials using email/password
5. Features available: Dashboard, Purchase Orders, Bills, Settings

Both accounts contain pre-populated demo data for complete feature review.
Note: OAuth buttons (Google/Apple) are also available but email/password 
login is recommended for review purposes.
```

---

## Portal Features Apple Will See

### Personnel Portal (Demo Personnel Account)
| Feature | Demo Data |
|---------|-----------|
| Dashboard | Summary cards, recent activity |
| Time Clock | Clock in/out functionality |
| Hours | 10+ time entries from past 2 weeks |
| Projects | ONE OAK CONDOMINIUM assignment |
| Reimbursements | Empty (can demo submission flow) |
| Documents | Empty (can demo upload flow) |
| Settings | Profile management, account deletion |

### Vendor Portal (Demo Vendor Account)
| Feature | Demo Data |
|---------|-----------|
| Dashboard | Summary cards, outstanding amounts |
| Purchase Orders | 1 PO worth $7,500 |
| Bills | 1 submitted bill for $2,500 |
| Settings | Profile management, account deletion |

---

## Security Note

These demo accounts:
- Use isolated email addresses that don't match any real personnel/vendors
- Have no access to real employee or vendor data
- Can only see their own demo records due to RLS policies
- Should be removed or deactivated after App Store approval

---

## Next Steps

1. Run the SQL scripts to create demo personnel, vendor, and sample data
2. Create auth users for both demo email addresses
3. Test login flow for both portals with demo credentials
4. Update App Store Connect with demo account information
5. Resubmit for App Store review

Would you like me to help execute these database insertions to set up the demo accounts?

