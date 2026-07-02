## Problem

SMS is failing. The `send-sms` edge function is reaching Twilio, but Twilio rejects every request with:

```
{"code":20003,"message":"Authenticate","status":401}
```

Error 20003 = Twilio does not recognize the credentials being sent. All three Twilio secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) exist in the backend, but at least one value is wrong, expired, or from a different Twilio account. No code changes needed.

## Steps

1. **User verifies in Twilio Console** (https://console.twilio.com):
   - Confirm Account SID (starts with `AC…`)
   - Copy the current Auth Token (rotate it if unsure — old tokens stop working immediately)
   - Confirm the sender number `+18555015395` is still owned by the account and SMS-enabled
   - Confirm the account is not suspended / trial-locked

2. **Update the stored secrets.** I will open the secure secret form for all three so any of them can be replaced:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

3. **Re-test.** Send one SMS from Messages. If Twilio returns success, we're done. If 20003 persists, the SID/Token pair still doesn't match — most likely the token was copied from a subaccount.

## Not doing (yet)

- Refactoring the 6 SMS edge functions to use the Lovable Twilio connector. Worth doing later to prevent this exact failure mode from recurring on every token rotation, but out of scope for this fix.
- Editing any code — this is a credential problem, not a code problem.

## Technical detail

The edge function logic is correct: it formats the phone to E.164, POSTs to `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` with HTTP Basic auth (`SID:AuthToken`), and maps common Twilio error codes to user-friendly messages. Twilio's 20003 is a pre-send auth check, so no messages are being delivered and no charges are being incurred.
