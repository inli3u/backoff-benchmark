import { afterEach, describe, test, expect, spyOn } from "bun:test";
import { exponentialBackoff, retryWait } from './backoff';

interface TrialResults {
  min: number;
  avg: number;
  max: number;
}

function runTrials(fn: () => number): TrialResults {
  const count = 500;
  let min = Number.MAX_VALUE;
  let max = Number.MIN_VALUE;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const val = fn();
    min = Math.min(min, val);
    max = Math.max(max, val);
    total += val;
  }
  const avg = total / count;
  return { min, avg, max };
}

describe('exponentialBackoff()', () => {
  // const spyOnRandom = spyOn(Math, 'random');

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

  test('start', () => {
    const start = 5;
    const backoff = exponentialBackoff({
      start,
      jitterPercent: 0,
    });
    expect(backoff(0)).toBe(start);
    expect(backoff(1)).toBe(start * Math.pow(2, 1));
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

  describe('jitterPercent', () => {
    test.each([
      [0, 1_000, 1_000, 1_000],
      [0.5, 500, 750, 1_000],
      [1, 0, 500, 1_000],
    ])
    ('Given a jitterPercent of %d, expect %d min, %d avg, and %d max delay time', (
      jitterPercent: number,
      expectedMin: number,
      expectedAvg: number,
      expectedMax: number,
    ) => {
      const start = 1_000;
      const backoff = exponentialBackoff({
        start,
        jitterPercent,
        jitterBias: 0,
      });

      // Run trials to get actual min, avg, and max.
      const actual = runTrials(() => backoff(0));
      
      // Actual value should be within 10% of expected value (+/- half of 10%).
      const tolerance = start * 0.1 / 2;
      expect(actual.min).toBeWithin(expectedMin - tolerance, expectedMin + tolerance);
      expect(actual.avg).toBeWithin(expectedAvg - tolerance, expectedAvg + tolerance);
      expect(actual.max).toBeWithin(expectedMax - tolerance, expectedMax + tolerance);
    });
  });

  describe('jitterBias', () => {
    test.each([
      [0, 0, 500, 1_000],
      [0.5, 500, 1_000, 1_500],
      [1, 1_000, 1_500, 2_000],
    ])
    ('Given a jitterBias of %d, expect %d min, %d avg, and %d max delay time', (
      jitterBias: number,
      expectedMin: number,
      expectedAvg: number,
      expectedMax: number,
    ) => {
      const start = 1_000;
      const backoff = exponentialBackoff({
        start,
        jitterPercent: 1,
        jitterBias,
      });

      // Run trials to get actual min, avg, and max.
      const actual = runTrials(() => backoff(0));

      // Actual value should be within 10% of expected value (+/- half of 10%).
      const tolerance = start * 0.1 / 2;
      expect(actual.min).toBeWithin(expectedMin - tolerance, expectedMin + tolerance);
      expect(actual.avg).toBeWithin(expectedAvg - tolerance, expectedAvg + tolerance);
      expect(actual.max).toBeWithin(expectedMax - tolerance, expectedMax + tolerance);
    });
  });

  describe('jitterRandomize', () => {
    test('once', () => {
      const backoff = exponentialBackoff({
        jitterPercent: 1,
        jitterBias: 0,
        jitterRandomize: 'once',
      });

      // Expect to get the same delay every call.
      const expected = backoff(0);
      expect(backoff(0)).toBe(expected);
      expect(backoff(0)).toBe(expected);
    });

    test('each', () => {
      const backoff = exponentialBackoff({
        jitterPercent: 1,
        jitterBias: 0,
        jitterRandomize: 'each',
      });

      // Expect to get a different delay each call.
      const expected = backoff(0);
      expect(backoff(0)).not.toBe(expected);
      expect(backoff(0)).not.toBe(expected);
    });
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