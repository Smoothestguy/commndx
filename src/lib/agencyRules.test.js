import { expect, it } from 'bun:test';
import { mayAttributeAgency } from '../../supabase/functions/_shared/agencyRules';
it('new agency-linked applicant may acquire an agency',()=>expect(mayAttributeAgency(null,'new')).toBe(true));
it('applicant-specific quick invite may attribute an untagged applicant',()=>expect(mayAttributeAgency(null,'invite')).toBe(true));
it('contact knowledge alone cannot rewrite an existing applicant agency',()=>expect(mayAttributeAgency(null,'contact')).toBe(false));
it('existing agency cannot be overwritten by a different hiring link',()=>expect(mayAttributeAgency('11111111-2222-4333-8444-555555555555','invite')).toBe(false));