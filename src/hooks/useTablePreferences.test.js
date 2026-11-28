import { it, expect } from 'bun:test';
import { resolveTablePreferences } from './useTablePreferences';

const ALL = ['name', 'perDiem', 'status', 'staffed', 'today', 'actions'];
const VISIBLE = ['name', 'staffed', 'today', 'actions'];

it('starts with only the non-hidden columns visible, while order keeps every column', () => {
  const prefs = resolveTablePreferences({ stored: null, defaultColumns: ALL, defaultVisible: VISIBLE });
  expect(prefs.visibleColumns).toEqual(VISIBLE);
  expect(prefs.columnOrder).toEqual(ALL);
});

it('keeps every column visible when no default-visible set is given', () => {
  const prefs = resolveTablePreferences({ stored: null, defaultColumns: ALL });
  expect(prefs.visibleColumns).toEqual(ALL);
  expect(prefs.columnOrder).toEqual(ALL);
});

it('a column added after the layout was saved appears only when it is not default-hidden', () => {
  const stored = JSON.stringify({ columnOrder: ['name', 'staffed', 'today'], visibleColumns: ['name', 'staffed', 'today'] });
  const prefs = resolveTablePreferences({
    stored,
    defaultColumns: ['name', 'staffed', 'today', 'open', 'perDiem'],
    defaultVisible: ['name', 'staffed', 'today', 'open'],
  });
  expect(prefs.visibleColumns).toEqual(['name', 'staffed', 'today', 'open']);
  expect(prefs.visibleColumns).not.toContain('perDiem');
  expect(prefs.columnOrder).toEqual(['name', 'staffed', 'today', 'open', 'perDiem']);
});

it('respects a saved choice to show a default-hidden column', () => {
  const stored = JSON.stringify({ columnOrder: ALL, visibleColumns: [...VISIBLE, 'perDiem'] });
  const prefs = resolveTablePreferences({ stored, defaultColumns: ALL, defaultVisible: VISIBLE });
  expect(prefs.visibleColumns).toEqual([...VISIBLE, 'perDiem']);
});

it('falls back to defaults when the stored layout is unreadable', () => {
  const prefs = resolveTablePreferences({ stored: '{oops', defaultColumns: ALL, defaultVisible: VISIBLE });
  expect(prefs.visibleColumns).toEqual(VISIBLE);
  expect(prefs.columnOrder).toEqual(ALL);
});
