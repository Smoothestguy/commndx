import {test,expect} from 'bun:test';
import {eventTabDestination} from './eventNavigation';
test('legacy operational tabs redirect to Locations',()=>{
  for(const tab of ['deployment','crew','time']) expect(eventTabDestination(tab)).toBe('locations');
});
test('financial and document links retain their destinations',()=>{
  expect(eventTabDestination('financials')).toBe('financials');
  expect(eventTabDestination('docs')).toBe('docs');
});