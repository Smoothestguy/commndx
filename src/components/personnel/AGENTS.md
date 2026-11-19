# Personnel rules
- Employer segment (customer > agency > FRG), tags and bench come from `src/lib/personnelSegment.ts` and `personnel_capabilities`; bench fields are trigger-guarded manager-only.
- Email-on-add separates insertion from delivery: retain saved results for retries. Share reuses current valid tokens and only falls back to authenticated createOnly without email or delivery tracking; ordinary Copy never mints.
- Delivery warnings use a staff-only minimal RPC over tracked sends; public opening stamps through a separate token-validating RPC without awaiting it, preserving legacy onboarding flow.
- Permanent deletion dialogs and both mutation paths share paginated manager-only history checks including audited non-disposable cascades; all-deleted applicant continuation is separate from history-preserving deactivation, and checks do not claim transactional race protection.
