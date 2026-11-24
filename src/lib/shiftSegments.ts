import { manualTimeRange, scheduledShift } from '@/lib/manualTime';

export type ShiftSegment = { tin: string; tout: string; outDay: string };
export type ShiftMode = 'day' | 'night' | 'split';
type Starts = Parameters<typeof scheduledShift>[2];

export const blankSegment = (day: string): ShiftSegment => ({ tin: '', tout: '', outDay: day });

/** Scheduled windows for a mode: split = [day window, night window]. */
export function shiftSegments(day: string, mode: ShiftMode, location?: Starts, project?: Starts): ShiftSegment[] {
  const one = (s: 'day' | 'night') => { const p = scheduledShift(day, s, location, project); return { tin: p.timeIn, tout: p.timeOut, outDay: p.outDay }; };
  return mode === 'split' ? [one('day'), one('night')] : [one(mode)];
}

/** Blank segments are ignored; partial/invalid segments are errors. */
export function segmentRanges(day: string, segments: ShiftSegment[], zone: string) {
  const ranges: { inAt: string; outAt: string; hours: number }[] = [];
  let invalid = false;
  for (const s of segments) {
    if (!s.tin && !s.tout) continue;
    const r = manualTimeRange(day, s.tin, s.tout, zone, s.outDay || day);
    if (r) ranges.push(r); else invalid = true;
  }
  return { ranges, invalid, hours: ranges.reduce((t, r) => t + r.hours, 0), ok: ranges.length > 0 && !invalid };
}
