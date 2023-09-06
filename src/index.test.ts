import { exponentialBackoff } from './';

describe('exponentialBackoff()', () => {
  test('initial test', () => {
    const backoff = exponentialBackoff({});
    expect(backoff(-5)).toBe(1);
    expect(backoff(0)).toBe(1);
    expect(backoff(5)).toBe(32);
  })
});
