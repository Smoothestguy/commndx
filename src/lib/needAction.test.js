import { expect, it } from 'bun:test';
import { needActionIds, needHint } from './needAction';
it('needAction = roster minus stays minus resolved', () => expect(needActionIds(['a','b','c','d','a'], ['b','x'], ['c'])).toEqual(['a','d']));
it('needAction is zero when everyone is accounted for', () => expect(needActionIds(['a','b'], ['a'], ['b']).length).toBe(0));
it('other site beats opened link and last clock-in', () => expect(needHint('2026-11-23', { otherSite: { name: 'Garner', time: '0712' }, openedLink: '0700', lastDay: '2026-11-22' })).toEqual({ kind: 'other_site', text: 'Clocked in at Garner 0712' }));
it('opened link beats last clock-in', () => expect(needHint('2026-11-23', { openedLink: '0705', lastDay: '2026-11-22' }).text).toBe('Opened link 0705, never clocked in'));
it('last clock-in 1 day back is not a warning', () => expect(needHint('2026-11-23', { lastDay: '2026-11-22' })).toEqual({ kind: 'last', text: 'Last clocked in 11/22', warn: false }));
it('last clock-in 2+ days back is a warning', () => expect(needHint('2026-11-23', { lastDay: '2026-11-21' }).warn).toBe(true));
it('no clock-ins yet', () => expect(needHint('2026-11-23', {}).text).toBe('No clock-ins yet'));
