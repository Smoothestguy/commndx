import { expect, it } from 'bun:test';
import { buildAttendanceCsv, missingByPerson, ATTENDANCE_CSV_HEADERS } from './customerOps';
const r = (o) => ({ visit_personnel_id: crypto.randomUUID(), personnel_id: 'p1', first_name: 'Ana', last_name: 'Diaz', local_day: '2026-11-20', in_at: '2026-11-20T13:30:00Z', out_at: '2026-11-21T01:30:00Z', hours: 12, signed: false, ...o });
it('customer timesheet export has no dollar columns', () => {
  const head = buildAttendanceCsv([r({})], 'America/New_York').split('\n')[0].toLowerCase();
  for (const w of ['rate', 'bill', 'pay', 'amount', 'cost', '$', 'per diem']) expect(head.includes(w)).toBe(false);
  expect(ATTENDANCE_CSV_HEADERS).toEqual(['Date', 'Name', 'Time In', 'Time Out', 'Hours', 'Signed']);
});
it('export times use the location timezone', () => expect(buildAttendanceCsv([r({})], 'America/New_York').split('\n')[1]).toBe('2026-11-20,Ana Diaz,08:30,20:30,12,No'));
it('a day with any signed stay is not missing', () => expect(missingByPerson([r({}), r({ signed: true })])).toEqual([]));
it('unsigned days group per person', () => expect(missingByPerson([r({ local_day: '2026-11-21' }), r({})])[0].dates).toEqual(['2026-11-20', '2026-11-21']));
