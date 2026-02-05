

# Enhanced Work Authorization Flow for Personnel Registration

## Overview
Transform Step 3 of the Personnel Registration form (`PersonnelRegister.tsx`) to implement a comprehensive conditional workflow that collects appropriate identification and documents based on citizenship and immigration status.

## Requirements Summary

| Status | Identifier Required | Documents Required |
|--------|---------------------|-------------------|
| U.S. Citizen | SSN | Government ID (Driver's License or Passport) |
| Non-Citizen: Visa | SSN | Visa documents |
| Non-Citizen: Work Permit | SSN | Work Permit/EAD documents |
| Non-Citizen: Green Card | SSN | Green Card (Front AND Back) |
| Non-Citizen: Other | ITIN | Work Authorization document |

## User Flow Diagram

```text
Step 3: Work Authorization
         |
         v
   "Are you a U.S. Citizen?"
         |
    +----+----+
    |         |
   Yes        No
    |         |
    v         v
  +-------+  "Select Immigration Status"
  |  SSN  |         |
  | Input |    +----+----+----+----+
  +-------+    |    |    |    |
    |        Visa  WP   GC  Other
    v          |    |    |    |
+----------+   v    v    v    v
| Gov ID   | SSN  SSN  SSN  ITIN
| Upload   |  +    +    +    +
+----------+ Visa  EAD  GC   Work Auth
             Doc   Doc  F&B  Doc
```

## Technical Implementation

### 1. Update Form State

Expand the `formData` state to include:
- `citizenship_status`: "us_citizen" | "non_us_citizen"
- `immigration_status`: "visa" | "work_permit" | "green_card" | "other"
- `ssn`: string (9-digit SSN for citizens and visa/work_permit/green_card holders)
- `itin`: string (9-digit ITIN for "other" immigration status)
- `documents`: Array of uploaded documents with type tags

### 2. Create ITIN Input Component

Create `src/components/personnel/registration/ITINInput.tsx`:
- Similar to `SSNInput` component but validates ITIN format
- ITIN must be 9 digits and start with "9"
- Format: 9XX-XX-XXXX
- Include show/hide toggle for security

### 3. Update Step 3 UI

Replace the current single dropdown with a multi-section form:

**Section A - Citizenship Question**
- Radio group: "Yes, I am a U.S. Citizen" / "No, I am not a U.S. Citizen"

**Section B - Conditional based on citizenship:**

**If U.S. Citizen:**
- SSN Input field (required)
- Government ID upload (Driver's License or Passport) - required

**If Non-U.S. Citizen:**
- Immigration Status dropdown (Visa, Work Permit, Green Card, Other)
- Based on selection:
  - **Visa**: SSN input + Visa document upload
  - **Work Permit**: SSN input + EAD document upload
  - **Green Card**: SSN input + Green Card Front + Green Card Back uploads
  - **Other**: ITIN input + Work Authorization document upload

### 4. Validation Rules

Update submit validation to require:
- Citizenship status must be selected
- If U.S. Citizen: SSN + Government ID document required
- If Non-Citizen:
  - Immigration status must be selected
  - For Visa/Work Permit/Green Card: SSN required + appropriate document(s)
  - For Other: ITIN required + Work Authorization document required

### 5. Data Mapping on Submit

Map the new fields to the database:
- Store SSN in `ssn_full` column (existing)
- Add ITIN to form data (will be stored appropriately)
- Store `citizenship_status` and `immigration_status` 
- Documents are uploaded to `personnel-documents` storage bucket

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/personnel/registration/ITINInput.tsx` | Create | ITIN input component with validation and masking |
| `src/pages/PersonnelRegister.tsx` | Modify | Expand Step 3 with conditional citizenship/immigration flow |

## UI Layout for Enhanced Step 3

```text
+--------------------------------------------------+
|  Step 3: Work Authorization                      |
+--------------------------------------------------+
|                                                  |
|  Are you a U.S. Citizen? *                       |
|    ( ) Yes                ( ) No                 |
|                                                  |
+--------------------------------------------------+
| [If "Yes" selected:]                             |
|                                                  |
|  Social Security Number (SSN) *                  |
|  +--------------------------------------+        |
|  | •••-••-1234                     [eye]|        |
|  +--------------------------------------+        |
|                                                  |
|  Government-Issued ID *                          |
|  +--------------------------------------+        |
|  | [Upload icon] Driver's License or    |        |
|  |               Passport               |        |
|  +--------------------------------------+        |
+--------------------------------------------------+
| [If "No" selected:]                              |
|                                                  |
|  Immigration Status *                            |
|  [Select status...                         v]    |
|                                                  |
+--------------------------------------------------+
| [If Visa selected:]                              |
|                                                  |
|  Social Security Number (SSN) *                  |
|  +--------------------------------------+        |
|  | Enter 9-digit SSN                    |        |
|  +--------------------------------------+        |
|                                                  |
|  Visa Documentation *                            |
|  +--------------------------------------+        |
|  | [Upload icon] Upload visa stamp/I-94 |        |
|  +--------------------------------------+        |
+--------------------------------------------------+
| [If Work Permit selected:]                       |
|                                                  |
|  Social Security Number (SSN) *                  |
|  +--------------------------------------+        |
|  | Enter 9-digit SSN                    |        |
|  +--------------------------------------+        |
|                                                  |
|  Employment Authorization Document (EAD) *       |
|  +--------------------------------------+        |
|  | [Upload icon] Upload EAD card        |        |
|  +--------------------------------------+        |
+--------------------------------------------------+
| [If Green Card selected:]                        |
|                                                  |
|  Social Security Number (SSN) *                  |
|  +--------------------------------------+        |
|  | Enter 9-digit SSN                    |        |
|  +--------------------------------------+        |
|                                                  |
|  Green Card (Front) *      Green Card (Back) *   |
|  +----------------+        +------------------+  |
|  | [Upload]       |        | [Upload]         |  |
|  +----------------+        +------------------+  |
+--------------------------------------------------+
| [If Other selected:]                             |
|                                                  |
|  Individual Taxpayer ID Number (ITIN) *          |
|  +--------------------------------------+        |
|  | 9XX-XX-XXXX                          |        |
|  +--------------------------------------+        |
|  (ITIN must start with 9)                        |
|                                                  |
|  Work Authorization Document *                   |
|  +--------------------------------------+        |
|  | [Upload icon] Upload work auth docs  |        |
|  +--------------------------------------+        |
+--------------------------------------------------+
```

## Validation Rules Summary

| Status | SSN Required | ITIN Required | Documents Required |
|--------|-------------|---------------|-------------------|
| U.S. Citizen | Yes | No | Government ID |
| Visa | Yes | No | Visa documentation |
| Work Permit | Yes | No | EAD document |
| Green Card | Yes | No | Green Card Front + Back |
| Other | No | Yes | Work Authorization document |

