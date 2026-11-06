import { describe, it, expect } from 'bun:test';
import { locationHref, navigationValue, withSearchValue } from './navigationState';
describe('deep links and preserved view state', () => {
  it('opens the task-order location tab directly', () => {
    expect(locationHref('x','y','taskorders')).toBe('/projects/x/locations/y?tab=taskorders');
  });
  it('URL view wins over the saved default', () => {
    expect(navigationValue('grid','cards',['cards','grid'])).toBe('grid');
  });
  it('missing or invalid view uses the saved default', () => {
    expect(navigationValue(null,'grid',['cards','grid'])).toBe('grid');
    expect(navigationValue('invalid','cards',['cards','grid'])).toBe('cards');
  });
  it('changing a timesheet search preserves tab, subtab, week and agency', () => {
    const result=withSearchValue('tab=deployment&sub=timesheet&week=2026-11-02&agency=agency-id','q','Ryan');
    expect(Object.fromEntries(result)).toEqual({tab:'deployment',sub:'timesheet',week:'2026-11-02',agency:'agency-id',q:'Ryan'});
  });
  it('explicit all choice wins over a narrower default', () => {
    expect(navigationValue('all','day',['all','day','night'])).toBe('all');
  });
});