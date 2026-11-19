# Personnel rules
- Employer segment (customer > agency > FRG), tags and bench come from `src/lib/personnelSegment.ts` and `personnel_capabilities`; bench fields are trigger-guarded manager-only.
- Email-on-add separates insertion from delivery: retain the saved result for retries, and copy only current valid onboarding tokens without silently minting or sending email.
- Delivery warnings use a staff-only minimal RPC over tracked sends; public opening stamps through a separate token-validating RPC without awaiting it, preserving legacy onboarding flow.
