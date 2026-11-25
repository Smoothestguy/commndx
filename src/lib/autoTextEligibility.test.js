import { it, expect } from 'bun:test';
import { ineligibleReason, parseAutoTextSettings, typeEnabled, autoTextDecision, kindToType } from '../../supabase/functions/_shared/autoTextEligibility';
const now = Date.parse('2026-11-24T15:00:00Z');
const base = () => ({ now, day: '2026-11-24', projectId: 'p1', optedOut: false, latestStatus: null,
  location: { status: 'active', mobe_date: '2026-11-01', demobe_date: null },
  project: { status: 'active', stage: 'active', deleted_at: null },
  assignment: { status: 'active', assigned_at: '2026-11-10T00:00:00Z', unassigned_at: null },
  person: { status: 'active', do_not_rehire: false, deleted_at: null } });
it('active person on active site is eligible', () => expect(ineligibleReason(base())).toBeNull());
it('closed location is not texted', () => expect(ineligibleReason({ ...base(), location: { status: 'closed' } })).toBe('site not active'));
it('completed project is not texted', () => expect(ineligibleReason({ ...base(), project: { status: 'completed', stage: 'complete' } })).toBe('project not active'));
it('canceled stage is not texted even if status active', () => expect(ineligibleReason({ ...base(), project: { status: 'active', stage: 'canceled' } })).toBe('project not active'));
it('after location demobe date is not texted', () => expect(ineligibleReason({ ...base(), location: { status: 'active', demobe_date: '2026-11-20' } })).toBe('after demobilization date'));
it('unassigned person is not texted', () => expect(ineligibleReason({ ...base(), assignment: { status: 'unassigned', assigned_at: '2026-11-10T00:00:00Z', unassigned_at: '2026-11-20T05:00:00Z' } })).toBe('unassigned'));
it('past unassigned_at is not texted', () => expect(ineligibleReason({ ...base(), assignment: { status: 'active', assigned_at: '2026-11-10T00:00:00Z', unassigned_at: '2026-11-24T05:00:00Z' } })).toBe('unassigned'));
it('future unassigned_at is still eligible', () => expect(ineligibleReason({ ...base(), assignment: { status: 'active', assigned_at: '2026-11-10T00:00:00Z', unassigned_at: '2026-11-25T05:00:00Z' } })).toBeNull());
it('future assigned_at is not texted', () => expect(ineligibleReason({ ...base(), assignment: { status: 'active', assigned_at: '2026-11-25T00:00:00Z', unassigned_at: null } })).toBe('not yet assigned'));
it('demobilized for this project is not texted', () => expect(ineligibleReason({ ...base(), latestStatus: { status: 'demobilized', project_id: 'p1' } })).toBe('demobilized'));
it('demobilized from another project stays eligible here', () => expect(ineligibleReason({ ...base(), latestStatus: { status: 'demobilized', project_id: 'p2' } })).toBeNull());
it('inactive or do-not-rehire person is not texted', () => { expect(ineligibleReason({ ...base(), person: { status: 'inactive' } })).toBe('person not active'); expect(ineligibleReason({ ...base(), person: { status: 'active', do_not_rehire: true } })).toBe('do not rehire'); });
it('opted out person is not texted', () => expect(ineligibleReason({ ...base(), optedOut: true })).toBe('opted out of texts'));
it('defaults keep every type on', () => { const s = parseAutoTextSettings(null); for (const t of ['preshift', 'no_show', 'checkout', 'auto_close']) expect(typeEnabled(s, t, 'L')).toBe(true); });
it('disabled type is skipped; master pause wins over location On', () => {
  expect(typeEnabled(parseAutoTextSettings({ types: { no_show: false } }), 'no_show', 'L')).toBe(false);
  expect(typeEnabled(parseAutoTextSettings({ paused: true, locations: { L: { no_show: 'on' } } }), 'no_show', 'L')).toBe(false);
});
it('per-location override beats global', () => {
  const s = parseAutoTextSettings({ types: { checkout: false, preshift: true }, locations: { L: { checkout: 'on', preshift: 'off' } } });
  expect(typeEnabled(s, 'checkout', 'L')).toBe(true); expect(typeEnabled(s, 'preshift', 'L')).toBe(false); expect(typeEnabled(s, 'checkout', 'Other')).toBe(false);
});
it('kinds map to setting types', () => { expect(kindToType('checkout_final')).toBe('checkout'); expect(kindToType('scheduled-auto-close:x')).toBe('auto_close'); expect(kindToType('supervisor')).toBeNull(); });
it('decision reports disabled before eligibility', () => {
  const ctx = { settings: parseAutoTextSettings({ types: { no_show: false } }), locations: new Map(), projects: new Map(), assignments: [], people: new Map(), latest: new Map(), opted: new Set() };
  expect(autoTextDecision(ctx, 'no_show', 'x', 'L', now)).toEqual({ send: false, reason: 'disabled', disabled: true });
  expect(autoTextDecision(ctx, 'preshift', 'x', 'L', now)).toEqual({ send: false, reason: 'site not active', disabled: false });
});
