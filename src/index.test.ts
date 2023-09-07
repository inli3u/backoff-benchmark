import { exponentialBackoff, retryWait } from './';

describe('exponentialBackoff()', () => {
  test('retries', () => {
    const backoff = exponentialBackoff({
      start: 1_000,
      jitterPercent: 0,
    });
    expect(backoff(-5)).toBe(1_000);
    expect(backoff(0)).toBe(1_000);
    expect(backoff(5)).toBe(32_000);
  });

  test('base', () => {
    const backoff = exponentialBackoff({
      base: 1.5,
      start: 1_000,
      jitterPercent: 0,
    });
    expect(backoff(0)).toBe(1_000);
    expect(backoff(1)).toBe(1_500);
    expect(Math.floor(backoff(5))).toBe(7_593);
  });

  test('ceiling', () => {
    const ceiling = 10_000;
    const backoff = exponentialBackoff({
      start: 1_000,
      jitterPercent: 0,
      ceiling,
    });
    expect(backoff(0)).toBe(1_000);
    expect(backoff(1)).toBe(2_000);
    expect(backoff(5)).toBe(ceiling);
  });
});

describe('retryWait()', () => {
  test('Promise resolves after specified time', async () => {
    // delay in miliseconds
    const expectedDelay = 100;

    // We'll give retryWait an identity function so that we can tell it exactly how long to wait.
    const wait = retryWait((n) => n);

    const start = Date.now();
    await wait(expectedDelay);
    const actualDelay = Date.now() - start;

    // Expect actual delay to be within 20 ms of expected delay
    expect(Math.abs(actualDelay - expectedDelay)).toBeLessThan(20);
  })
});