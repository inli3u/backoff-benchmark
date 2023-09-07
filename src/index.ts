export type RetryFn = (retries: number) => number;
export type WaitFn = (retries: number) => Promise<void>;

export interface ExponentialBackoffOpts {
  base?: number;
  start?: number;
  ceiling?: number;
  jitterPercent?: number;
  jitterBias?: number;
  jitterRandomize?: 'once' | 'each';
}

type ExponentialBackoffFn = (opts: ExponentialBackoffOpts) => RetryFn;

/**
 * Builds and returns a backoff function.
 */
export const exponentialBackoff: ExponentialBackoffFn = ({
  base = 2,
  start = 1_000,
  ceiling = Number.POSITIVE_INFINITY,
  jitterPercent = 1,
  jitterBias = 0.5,
  jitterRandomize = 'once',
}) => {
  let random = Math.random;

  if (jitterRandomize === 'once') {
    const n = Math.random();
    random = () => n;
  }

  return (retries) => {
    retries = Math.max(retries, 0);

    let wait = base ** retries * start;
    wait = Math.min(ceiling, wait);

    if (jitterPercent) {
      const amount = (wait - start) * jitterPercent;
      wait += amount * random();
    }

    return wait;
  };
};


type RetryWaitFn = (fn: RetryFn) => WaitFn;

/**
 * Maps a RetryFn to a WaitFn so that you can await the retry time.
 */
export const retryWait: RetryWaitFn = (fn) => {
  return (retries) => {
    return new Promise((resolve, reject) => setTimeout(resolve, fn(retries)));
  };
};
