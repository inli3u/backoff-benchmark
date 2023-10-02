export type RetryFn = (retries: number, client?: number) => number;
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
  jitterRandomize = 'each',
}) => {
  const randomOnce = Math.random();
  const random = () =>
    (jitterRandomize === 'once' ? randomOnce : Math.random())

  return (retries, client) => {
    retries = Math.max(retries, 0);

    let wait = base ** retries * start;
    wait = Math.min(ceiling, wait);

    if (jitterPercent) {
      const amount = wait * jitterPercent * (random() - jitterBias);
      wait += amount;
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
