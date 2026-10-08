# Architecture rules

- Staff applicant locations use the shared applicant location formatter and a view-level cached ZIP batch lookup; preserve applicant fields and resolve fallbacks only for display to avoid per-row requests and unnecessary writes.