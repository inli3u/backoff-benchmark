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

function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

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
  // let random = Math.random;
  // let random = mulberry32(1);
  // let random = mulberry32;

  // if (jitterRandomize === 'once') {
  //   const rand = mulberry32(Math.random());
  //   random = () => n;
  // }

  const random = () => {
    const rand = mulberry32(Math.random() * 1000);
    const r = rand();
    // console.log('Random:', r);
    return r;
  }

  const clientOffset = Math.random() * 1000;
  const randomForClient = (client?: number) => {
    const rand = mulberry32(client ?? 0 + clientOffset);
    const r = rand();
    // console.log('Random:', client, r);
    return r;
  }

  return (retries, client) => {
    retries = Math.max(retries, 0);

    let wait = base ** retries * start;
    wait = Math.min(ceiling, wait);

    if (jitterPercent) {
      const amount = (wait - start) * jitterPercent;
      wait += amount * (jitterRandomize === 'once' ? randomForClient(client) : random());
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
