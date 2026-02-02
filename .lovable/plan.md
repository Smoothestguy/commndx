

# Google Play Developer Content Policy Compliance Audit

## Summary

Command X is a workforce management app that collects sensitive personal data (SSN, bank information, location). Based on the Google Play Developer Content Policy requirements, I've identified several areas that need attention for full compliance.

---

## Compliance Assessment

### 1. User Data Policy

| Requirement | Current Status | Action Needed |
|-------------|----------------|---------------|
| Privacy Policy in app | Have `/legal/privacy` route | None |
| Privacy Policy link in Play Console | Need to configure | Add URL in Play Console |
| Data Safety Section | Not yet completed | Must complete form in Play Console |
| Account deletion option | Implemented via `delete-own-account` edge function | None |
| Account deletion link in Play Console | Need to configure | Add deletion URL in Play Console |

### 2. Prominent Disclosure & Consent (Critical)

**Issue**: The app collects **background location data** for geofencing. Google requires:
1. In-app disclosure **before** requesting permission
2. Clear explanation of what data is collected and why
3. Disclosure must be **within the app**, not just in privacy policy

**Current Implementation**: The `PermissionRequestFlow.tsx` component shows a dialog explaining location use - this partially meets the requirement but needs enhancement.

**Required Changes**:
- Add more specific disclosure text matching Google's template: "Command X collects location data to enable automatic clock-out when you leave job sites, even when the app is closed or not in use."
- Ensure the disclosure appears **before** the system permission dialog
- Add disclosure about background location usage specifically

### 3. Data Safety Section (Play Console)

You must declare in Google Play Console:

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| **Precise location** | Yes | No | App functionality (geofencing) |
| **Background location** | Yes | No | Auto clock-out feature |
| **Name** | Yes | No | Account/profile |
| **Email address** | Yes | No | Authentication |
| **Phone number** | Yes | Twilio (for SMS) | Notifications |
| **Government ID (SSN)** | Yes | No | Employment compliance |
| **Financial info (bank account)** | Yes | No | Payroll/direct deposit |
| **Photos** | Yes | No | Document uploads |

### 4. Permissions Policy

**Background Location**: Google has strict requirements:
- Must have a core feature that **requires** background location
- Must provide prominent disclosure
- Cannot use for advertising

**Your justification**: Auto-clock-out when leaving job site is a valid core feature.

### 5. Security Vulnerabilities (Must Fix Before Submission)

The security scan revealed critical issues that violate Google's User Data policy on "secure handling":

| Issue | Severity | Details |
|-------|----------|---------|
| QuickBooks OAuth tokens exposed | CRITICAL | `quickbooks_config` table readable by all authenticated users |
| Personnel SSN/bank data exposed | CRITICAL | `personnel` table with sensitive data has overly permissive RLS |
| Emergency contacts exposed | HIGH | Personal contact info readable by all users |
| Messages table exposed | HIGH | Phone numbers and message content accessible |

**These must be fixed** - Google requires "Handle all personal and sensitive user data securely."

### 6. Privacy Policy Updates Needed

Your current privacy policy needs additions for Google Play compliance:

| Required Section | Status |
|------------------|--------|
| Developer contact information | Have email only - add physical address |
| Types of data collected | Incomplete - missing SSN, bank info, government ID |
| Background location disclosure | Missing |
| Data retention policy | Basic mention - needs specifics |
| Children's privacy | Missing (should state app is not for children) |

### 7. App Backup Security

**Issue**: `android:allowBackup="true"` in AndroidManifest.xml could expose sensitive data.

**Fix**: Add `android:dataExtractionRules` or set `android:allowBackup="false"` since this app handles SSN and bank data.

---

## Implementation Plan

### Phase 1: Critical Security Fixes (Required)

| File | Change |
|------|--------|
| Database migration | Restrict `quickbooks_config` RLS policy to admins only |
| Database migration | Restrict `personnel` table RLS - only allow self-access for non-admins |
| Database migration | Restrict `emergency_contacts` RLS policy |
| Database migration | Restrict `messages` table RLS policy |

### Phase 2: Disclosure & Consent Updates

| File | Change |
|------|--------|
| `src/components/location/PermissionRequestFlow.tsx` | Update disclosure text to meet Google's template format |
| New component | Add prominent disclosure screen that appears before permission request |
| `src/pages/legal/PrivacyPolicy.tsx` | Add missing data types (SSN, bank info, background location) |
| `src/pages/legal/PrivacyPolicy.tsx` | Add children's privacy statement |
| `src/pages/legal/PrivacyPolicy.tsx` | Add physical contact address |

### Phase 3: Android Configuration

| File | Change |
|------|--------|
| `android/app/src/main/AndroidManifest.xml` | Set `android:allowBackup="false"` or add `dataExtractionRules` |
| `android/app/src/main/res/xml/data_extraction_rules.xml` | Create file to exclude sensitive data from backup |

### Phase 4: Play Console Configuration (Manual)

1. Complete Data Safety form with all data types listed above
2. Add Privacy Policy URL: `https://commndx.lovable.app/legal/privacy`
3. Add Account Deletion URL: `https://commndx.lovable.app/portal/settings` (or create dedicated deletion page)
4. Content Rating questionnaire
5. Target audience and content declaration

---

## Technical Details

### Database Migration for RLS Hardening

```sql
-- Secure QuickBooks tokens
DROP POLICY IF EXISTS "Authenticated users can view quickbooks config" ON public.quickbooks_config;
CREATE POLICY "Only admins can view QuickBooks config"
  ON public.quickbooks_config FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Secure personnel sensitive data
DROP POLICY IF EXISTS "Authenticated users can view personnel" ON public.personnel;
CREATE POLICY "Admins and managers can view all personnel"
  ON public.personnel FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Personnel can view own record"
  ON public.personnel FOR SELECT
  USING (user_id = auth.uid());

-- Similar for emergency_contacts and messages tables
```

### Updated Location Disclosure Component

The `PermissionRequestFlow.tsx` needs updated disclosure text:

```
"Command X collects location data to enable automatic clock-out 
when you leave job sites, even when the app is closed or not in use. 
Your location is only tracked while you are clocked in to a job site."
```

### Android Backup Configuration

Create `android/app/src/main/res/xml/data_extraction_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="sharedpref" path="."/>
        <exclude domain="database" path="."/>
    </cloud-backup>
    <device-transfer>
        <exclude domain="sharedpref" path="."/>
        <exclude domain="database" path="."/>
    </device-transfer>
</data-extraction-rules>
```

---

## Checklist for Google Play Submission

- [ ] Fix critical RLS policy vulnerabilities
- [ ] Update PermissionRequestFlow with compliant disclosure
- [ ] Update Privacy Policy with all required sections
- [ ] Disable or restrict Android backup
- [ ] Complete Data Safety form in Play Console
- [ ] Add Privacy Policy URL in Play Console
- [ ] Add Account Deletion URL in Play Console
- [ ] Complete Content Rating questionnaire
- [ ] Verify app targets users 13+ (not children)

