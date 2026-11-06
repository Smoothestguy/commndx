import { expect, it } from 'bun:test';
import { affectedStayDates, affectedStayWeeks, draftStay, stayRange, staysForCell } from './stayEdits';
it('corrects a 13.20-hour stay to the requested in/out interval', () => {
  const draft = draftStay('stay', '2026-11-05T13:00:00Z', '2026-11-06T02:12:00Z', 'America/Chicago');
  draft.outTime = '16:00'; draft.outDate = '2026-11-05';
  expect(stayRange(draft, 'America/Chicago')).toEqual({ inAt: '2026-11-05T13:00:00.000Z', outAt: '2026-11-05T22:00:00.000Z' });
});
it('allows setting time out on a running stay and rejects out before in', () => {
  const draft = draftStay('stay', '2026-11-05T13:00:00Z', null, 'America/Chicago', '2026-11-05');
  expect(stayRange(draft, 'America/Chicago')?.outAt).toBeNull();
  draft.outTime = '16:00'; expect(stayRange(draft, 'America/Chicago')?.outAt).toBe('2026-11-05T22:00:00.000Z');
  draft.outTime = '06:00'; expect(stayRange(draft, 'America/Chicago')).toBeNull();
});
it('retains overnight dates rather than flipping an existing stay', () => {
  const draft = draftStay('stay', '2026-11-05T23:00:00Z', '2026-11-06T12:00:00Z', 'America/Chicago');
  expect(draft.outDate).toBe('2026-11-06');
  expect(stayRange(draft, 'America/Chicago')?.outAt).toBe('2026-11-06T12:00:00.000Z');
});
it('protects old and proposed days and weeks when shortening or moving a stay', () => {
  expect(affectedStayDates('2026-11-08T14:00Z','2026-11-10T14:00Z','2026-11-08T14:00Z','2026-11-08T22:00Z','America/Chicago')).toEqual(['2026-11-08','2026-11-09','2026-11-10']);
  expect(affectedStayWeeks('2026-11-08T14:00Z','2026-11-10T14:00Z','2026-11-08T14:00Z','2026-11-08T22:00Z','America/Chicago')).toEqual(['2026-11-02','2026-11-09']);
});
it('timesheet cell includes all matching stays or only the selected location, once per stay', () => {
  const entries = [{id:'a:2026-11-05',personnel_id:'p',date:'2026-11-05',location_id:'one'}, {id:'b:2026-11-05',personnel_id:'p',date:'2026-11-05',location_id:'two'}, {id:'c:2026-11-06',personnel_id:'p',date:'2026-11-06',location_id:'one'}];
  expect(staysForCell(entries,'p','2026-11-05').map(e=>e.id)).toEqual(['a:2026-11-05','b:2026-11-05']);
  expect(staysForCell(entries,'p','2026-11-05','one').map(e=>e.id)).toEqual(['a:2026-11-05']);
});