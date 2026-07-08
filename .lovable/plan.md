# Diagnosis: Inbound SMS Replies Not Received

## Root cause (found)

The active sending number **+1 (855) 501-5395** has its Twilio inbound `smsUrl` pointed at a **different / stale Supabase project**:

```
current smsUrl : https://yljqjvqraahykzemsxrr.functions.supabase.co/twilio-webhook
should be      : https://xfjjvznxkcckuwxmcsdc.functions.supabase.co/twilio-webhook
```

Because Twilio POSTs incoming SMS to the wrong project, this project's `twilio-webhook` function is never invoked — confirmed: **zero logs** on `twilio-webhook` in this project, even though outbound sends from this number are working today.

The secondary number **+1 (254) 374-8326** is even worse — its `smsUrl` is still the Twilio demo endpoint `https://demo.twilio.com/welcome/sms/reply`, which auto-replies with a canned message and stores nothing.

## What exists (good)

- **Edge function `supabase/functions/twilio-webhook/index.ts`** — deployed, correctly implemented:
  - Parses Twilio form-encoded `From` / `Body`
  - Matches phone digits against `personnel`, `customers`, `applicants`
  - Reuses the latest `conversations` row or creates a new one with an admin as participant_1
  - Inserts into `conversation_messages` (type `sms`)
  - Updates `conversations.last_message_at` / `last_message_preview`
  - Calls `increment_unread_count` RPC
  - Returns empty TwiML
- **`supabase/config.toml`** has `[functions.twilio-webhook] verify_jwt = false` ✅ (Twilio can reach it without a JWT).
- **UI surface exists**: `src/pages/Messages.tsx` + `src/pages/Conversations.tsx` read `conversations` / `conversation_messages` via `useConversations` and `usePersonnelCommunicationLog`. Inbound replies would appear in the unified Messages inbox and on each personnel/applicant/customer communication log automatically once rows land in `conversation_messages`.

## What's missing / broken

1. **Twilio number config** — `smsUrl` on +18555015395 points at the wrong project domain.
2. **Second number** +12543748326 still on Twilio demo URL (no capture at all).
3. No `StatusCallback` set on either number, so we also don't record delivery/failure updates for outbound SMS.

## Minimal repair plan (do not build yet)

1. **Repoint inbound webhook** for both Twilio numbers:
   - `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/IncomingPhoneNumbers/{PN_SID}.json`
   - Body: `SmsUrl=https://xfjjvznxkcckuwxmcsdc.functions.supabase.co/twilio-webhook`, `SmsMethod=POST`
   - Apply to both PN records (855 and 254).
2. **Verify** by sending a real inbound SMS from a known applicant/personnel phone and confirming:
   - `twilio-webhook` logs show the incoming request
   - A row appears in `conversation_messages` with `message_type = 'sms'`
   - The reply surfaces in `/messages` (unified inbox) and the personnel/applicant communication log
3. **(Recommended, optional)** Also set `StatusCallback` on both numbers to a new/updated status endpoint so we track delivered/failed outbound messages. Not required to fix the reported bug.
4. **No code changes required** to the edge function, DB tables, or UI — they already work end-to-end. This is purely a Twilio number configuration fix, executed via a one-off Twilio API call (same credentials already in secrets).

## Notes / caveats

- The `twilio-webhook` handler creates a new conversation using the *first* profile row (`profiles ... limit(1)`) as participant_1 when no prior conversation exists. That means an inbound reply from a brand-new number will be attached to a somewhat arbitrary admin. Acceptable for now — call out if you want smarter routing (e.g., the sender of the last outbound SMS) as a follow-up.
- Unknown phone numbers are logged and dropped (no storage). If you want a catch-all "unknown sender" bucket surfaced in the UI, that's a separate feature.

Ready to switch to build mode and run the Twilio API repoint when you approve.
