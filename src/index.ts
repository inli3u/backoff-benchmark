type RetryFn = (retries: number) => number;
type RetryWaitFn = (retries: number) => Promise<void>;

interface ExponentialBackoffOpts {
  base?: number;
  ceiling?: number;
  jitterPercent?: number;
  jitterBias?: number;
  jitterTime?: 'early' | 'late'
}

export const exponentialBackoff = (opts: ExponentialBackoffOpts): RetryFn => {
  return (retries: number) => {
    retries = Math.max(0, retries);
    return 2 ** retries;
  };
};

/**
 * Maps a RetryFn to a RetryWaitFn that returns a promise and can be awaited.
 */
export const retryWait = (fn: RetryFn): RetryWaitFn => {
  return (retries: number) => {
    return new Promise((resolve, reject) => setTimeout(resolve, fn(retries)));
  };
};
