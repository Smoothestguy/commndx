import { z } from 'zod';
export const checkoutRoundingOptions = [1, 5, 10, 15, 30] as const;
export const shiftRuleDefaults = { reminder_lead_minutes: 5, early_window_minutes: 10, late_grace_minutes: 15, late_max_minutes: 240, auto_close_after_hours: 14, checkout_rounding_minutes: 15 };
export const projectShiftRulesSchema = z.object({
  reminder_lead_minutes: z.number().int().nonnegative(),
  early_window_minutes: z.number().int().nonnegative(),
  late_grace_minutes: z.number().int().nonnegative(),
  late_max_minutes: z.number().int().nonnegative(),
  auto_close_after_hours: z.number().positive(),
  checkout_rounding_minutes: z.number().refine(v => checkoutRoundingOptions.some(n => n === v), 'Choose 1, 5, 10, 15 or 30 minutes'),
});