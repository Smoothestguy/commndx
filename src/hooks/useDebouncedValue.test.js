import { expect, test } from 'bun:test';
import { scheduleDebouncedValue, SEARCH_DEBOUNCE_MS } from './useDebouncedValue';

test('server search waits 300ms and cancels superseded typing', async () => {
  expect(SEARCH_DEBOUNCE_MS).toBe(300);
  const values = [];
  const cancel = scheduleDebouncedValue('r', value => values.push(value));
  cancel();
  scheduleDebouncedValue('raymond', value => values.push(value));
  expect(values).toEqual([]);
  await new Promise(resolve => setTimeout(resolve, 150));
  expect(values).toEqual([]);
  await new Promise(resolve => setTimeout(resolve, 180));
  expect(values).toEqual(['raymond']);
});