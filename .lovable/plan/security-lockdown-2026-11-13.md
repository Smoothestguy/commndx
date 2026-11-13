# Security lockdown

## What will change
- Inventory every privileged function and its real callers. Close anonymous execution by default; explicitly preserve verified token-gated public flows and guarded application intake.
- Remove direct anonymous vendor access and replace onboarding reads with token-validated safe responses.
- Make evidence/upload buckets private, remove anonymous read policies, and update display and PDF paths to use short-lived authorized URLs.
- Address additional verified advisor exposures, preserve production history and paused schedules, and record the closed-by-default function rule.

## Verification
- Test forbidden calls as anonymous, including applicant merge and enumeration.
- Exercise public application submission using disposable verification data; verify join, punch, kiosk, portals, photo requests and signed PDF access without punching or notifying real workers.
- Clean verification records in the same run and rerun advisors and focused tests. Report any unavailable real-token checks explicitly.

## Technical details
- Use additive audited migrations, explicit grants, server-side role/token checks and existing private-storage access patterns.
- Do not introduce ad-hoc rate limiting: inexpensive validation guards will bound intake inputs without claiming infrastructure-level limits.
