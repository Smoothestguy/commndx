# Onboarding email-on-add and copy

1. Add an admin/manager-only, default-checked Send onboarding link now checkbox. After insertion succeeds, use the existing onboarding email sender. Retain the saved record on failure and offer Retry without another insert.
2. Keep an add confirmation visible with the returned onboarding link and desktop Copy link action.
3. Profile Copy link reads the newest current valid onboarding token. If none exists, explain that the existing mint path also emails and stop without sending.
4. Remove personnel Merge from duplicate review; retain both profile links and Not duplicates. Other entity merges remain unchanged.
5. Test mocked email delivery and disposable cleanup, then verify protected-file diff, punch/kiosk loading and legacy onboarding submission.

No migrations, database schema/function changes, new email/text services, code-rule changes, schedules or protected operational changes. Phase 1 remains as is.