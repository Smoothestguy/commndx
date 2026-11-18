import { describe, it, expect } from 'bun:test';
import { retryApplicationSubmit, isSubmitNetworkError } from './applicationSubmit';
describe('public application network retries', () => {
  it('retries Safari dropped requests exactly three times at 1, 3, 6 seconds', async () => {
    const delays = []; let calls = 0;
    await expect(retryApplicationSubmit(async () => { calls++; throw new TypeError('Load failed'); }, async ms => { delays.push(ms); })).rejects.toThrow('Load failed');
    expect(calls).toBe(4); expect(delays).toEqual([1000, 3000, 6000]);
  });
  it('does not retry HTTP validation errors even when their text mentions fetch', async () => {
    let calls = 0;
    await expect(retryApplicationSubmit(async () => { calls++; throw { message: 'Failed to fetch', context: { status: 400 } }; })).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
  it('returns the successful retry result', async () => {
    let calls = 0;
    const value = await retryApplicationSubmit(async () => { if (++calls < 3) throw { name: 'FunctionsFetchError' }; return 'receipt'; }, async () => {});
    expect(value).toBe('receipt'); expect(calls).toBe(3);
  });
  it('does not retry database or server errors', () => {
    expect(isSubmitNetworkError({ message: 'unique constraint', code: '23505' })).toBe(false);
    expect(isSubmitNetworkError({ message: 'Load failed', context: { status: 500 } })).toBe(false);
  });
});