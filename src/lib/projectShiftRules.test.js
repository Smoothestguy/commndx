import { it, expect } from 'bun:test';
import { projectShiftRulesSchema, shiftRuleDefaults } from './projectShiftRules';
it('reminder defaults to five minutes', () => expect(shiftRuleDefaults.reminder_lead_minutes).toBe(5));
it('early window defaults to ten minutes', () => expect(shiftRuleDefaults.early_window_minutes).toBe(10));
it('late grace defaults to fifteen minutes', () => expect(shiftRuleDefaults.late_grace_minutes).toBe(15));
it('max late defaults to 240 minutes', () => expect(shiftRuleDefaults.late_max_minutes).toBe(240));
it('auto close defaults to fourteen hours', () => expect(shiftRuleDefaults.auto_close_after_hours).toBe(14));
it('rounding accepts only 1/5/10/15/30 and defaults to fifteen', () => { expect(shiftRuleDefaults.checkout_rounding_minutes).toBe(15); for(const v of [1,5,10,15,30]) expect(projectShiftRulesSchema.safeParse({...shiftRuleDefaults,checkout_rounding_minutes:v}).success).toBe(true); expect(projectShiftRulesSchema.safeParse({...shiftRuleDefaults,checkout_rounding_minutes:20}).success).toBe(false); });
it('persists chosen settings rather than resetting defaults', () => expect(projectShiftRulesSchema.parse({reminder_lead_minutes:12,early_window_minutes:8,late_grace_minutes:20,late_max_minutes:180,auto_close_after_hours:16,checkout_rounding_minutes:5})).toEqual({reminder_lead_minutes:12,early_window_minutes:8,late_grace_minutes:20,late_max_minutes:180,auto_close_after_hours:16,checkout_rounding_minutes:5}));