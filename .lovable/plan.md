
# Plan: Add "Message Incomplete Onboarding Personnel" Feature to Messages Page

## Overview

You have **30 active personnel** with pending or incomplete onboarding who have phone numbers. This feature will add a quick action in the Messages page to send bulk SMS reminders to personnel who haven't completed their onboarding.

---

## Current State Analysis

**Personnel Onboarding Status (Active Only):**
| Status | Count |
|--------|-------|
| Pending | 30 |
| Completed | 17 |
| Revoked | 1 |

**30 personnel** with incomplete onboarding have valid phone numbers and can receive SMS.

---

## Solution Design

### Approach: Add "Onboarding Reminders" Quick Action

Add a new button in the Messages page header that opens a specialized bulk SMS dialog for incomplete onboarding personnel.

### UI Changes

**Messages Page Header Enhancement:**
```
[Conversations] ————————————— [Onboarding Reminders] [New Message]
```

The "Onboarding Reminders" button will:
1. Fetch all active personnel where `onboarding_status != 'completed'`
2. Open a bulk SMS dialog pre-filtered to those personnel
3. Include a pre-written template message with the onboarding link

---

## Technical Implementation

### 1. Create New Component: `OnboardingReminderDialog.tsx`

**Location:** `src/components/messaging/OnboardingReminderDialog.tsx`

**Features:**
- Fetches personnel with incomplete onboarding (`onboarding_status = 'pending'` or `null` or `revoked`)
- Shows count of recipients with/without phone numbers
- Pre-populates message template with onboarding portal link
- Uses existing `send-bulk-sms` edge function (no projectId required)
- Includes personalization tokens if needed

**Key Logic:**
```typescript
// Query for incomplete onboarding personnel
const { data: personnel } = await supabase
  .from("personnel")
  .select("id, first_name, last_name, phone, onboarding_status")
  .eq("status", "active")
  .neq("onboarding_status", "completed")
  .not("phone", "is", null);
```

**Default Message Template:**
```
Hi! This is a reminder to complete your onboarding paperwork. 
Please visit the portal link we sent you to finish your documents. 
If you need a new link, please let us know. Thank you!
```

### 2. Modify Edge Function: `send-bulk-sms`

**Current limitation:** Requires `projectId` and `projectName`.

**Update needed:** Make `projectId` optional for non-project-specific bulk messages (like onboarding reminders).

**Changes:**
```typescript
// Updated interface
interface BulkSMSRequest {
  projectId?: string;   // Now optional
  projectName?: string; // Now optional
  content: string;
  recipientIds: string[];
  messageContext?: string; // New field: 'onboarding_reminder', 'project_notification', etc.
}

// Updated validation
if (!content || !recipientIds?.length) {
  return new Response(
    JSON.stringify({ error: "Missing required fields: content, recipientIds" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### 3. Update Messages Page UI

**File:** `src/components/messaging/MessagesInbox.tsx`

**Add new button and dialog:**
```tsx
// State
const [showOnboardingReminder, setShowOnboardingReminder] = useState(false);

// Header button
<Button onClick={() => setShowOnboardingReminder(true)} variant="outline" size="sm">
  <ClipboardList className="h-4 w-4 mr-2" />
  Onboarding Reminders
</Button>

// Dialog
<OnboardingReminderDialog
  open={showOnboardingReminder}
  onOpenChange={setShowOnboardingReminder}
/>
```

### 4. Create Hook: `useIncompleteOnboardingPersonnel`

**Location:** `src/integrations/supabase/hooks/useIncompleteOnboardingPersonnel.ts`

```typescript
export function useIncompleteOnboardingPersonnel() {
  return useQuery({
    queryKey: ["personnel", "incomplete-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, phone, email, onboarding_status")
        .eq("status", "active")
        .or("onboarding_status.is.null,onboarding_status.eq.pending,onboarding_status.eq.revoked")
        .order("first_name");
      
      if (error) throw error;
      return data;
    },
  });
}
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/messaging/OnboardingReminderDialog.tsx` | **Create** | New dialog for bulk SMS to incomplete onboarding personnel |
| `src/integrations/supabase/hooks/useIncompleteOnboardingPersonnel.ts` | **Create** | Hook to fetch personnel with incomplete onboarding |
| `src/components/messaging/MessagesInbox.tsx` | **Modify** | Add "Onboarding Reminders" button to header |
| `supabase/functions/send-bulk-sms/index.ts` | **Modify** | Make `projectId` optional for general bulk messages |

---

## User Flow

1. Navigate to **Messages** page
2. Click **"Onboarding Reminders"** button in header
3. Dialog opens showing:
   - Count of personnel with incomplete onboarding (30 currently)
   - List of recipients with phone numbers
   - Warning for any without phone numbers
   - Pre-filled message template
4. Edit message if needed
5. Click **"Send Reminder"**
6. Confirmation dialog appears
7. Messages sent via Twilio
8. Success/failure toast notification

---

## Alternative Enhancement: Filter by Onboarding Status in NewConversationDialog

As an additional improvement, the "New Conversation" dialog could add a filter toggle to show only personnel with incomplete onboarding:

```tsx
<Checkbox
  checked={showIncompleteOnboardingOnly}
  onCheckedChange={setShowIncompleteOnboardingOnly}
/>
<label>Show only incomplete onboarding</label>
```

This would help when you want to message individuals one-at-a-time rather than in bulk.

---

## Security Considerations

- The edge function already validates user roles (admin/manager required)
- RLS policies protect personnel data access
- Phone numbers are formatted and validated before sending

