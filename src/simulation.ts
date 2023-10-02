const asciichart = require('asciichart');
import { RetryFn, exponentialBackoff } from ".";
import {
  PriorityQueue,
  MinPriorityQueue,
  MaxPriorityQueue,
  ICompare,
  IGetCompareValue,
} from '@datastructures-js/priority-queue';


interface Timeout {
  runAtTime: number;
  fn: () => void;
}

const compareTimeouts: ICompare<Timeout> = (a, b) => {
  if (a.runAtTime > b.runAtTime) return 1;
  if (a.runAtTime < b.runAtTime) return -1;
  return 0;
};

class World {
  private time = 0
  private queue = new PriorityQueue(compareTimeouts);

  processQueue() {
    while (!this.queue.isEmpty()) {
      const { runAtTime, fn } = this.queue.dequeue();
      this.time = runAtTime;
      fn();
    }
  }

  setTimeout(delay: number, fn: () => void) {
    this.queue.enqueue({ runAtTime: this.now() + delay, fn });
  }

  now(): number {
    return this.time;
  }

  run(fn: () => void) {
    if (!this.queue.isEmpty()) {
      throw new Error('Queue is not empty');
    }
    this.time = 0;
    fn();
    this.processQueue();
  }
}

function dist(values: number[], qlist: number[]): number[] {
  if (!values.length) return [];

  values = [...values].sort((a, b) => a - b);
  return qlist.map((q) => {
    const i = Math.floor((values.length - 1) * q);
    if (i < 0 || i >= values.length) {
      console.warn('dist(): index out of bounds');
      return NaN;
    }
    return values[i];
  });
}

class Sampler {
  private samples = new Map<number, number>();
  private minBucket = Number.MAX_VALUE;
  private maxBucket = Number.MIN_VALUE;

  constructor(private bucketSize: number) {

  }

  push(time: number, value: number) {
    const bucket = Math.floor(time / this.bucketSize);
    this.samples.set(bucket, (this.samples.get(bucket) ?? 0) + value);
    this.minBucket = Math.min(this.minBucket, bucket);
    this.maxBucket = Math.max(this.maxBucket, bucket);
  }

  collect(): number[] {
    const values: number[] = [];
    for (let bucket = this.minBucket; bucket <= this.maxBucket; bucket++) {
      const n = this.samples.get(bucket);
      if (!n) {
        values.push(0);
      } else {
        values.push(n);
      }
    }
    return values;
  }

  collectAndReset(): number[] {
    const values = this.collect();
    this.samples = new Map();
    this.minBucket = Number.MAX_VALUE;
    this.maxBucket = Number.MIN_VALUE;
    return values;
  }
}

const world = new World();
// const sampler = new Sampler(1_000);



interface Server {
  handleRequest(): boolean;
  requests: number;
  failed: number;
  succeeded: number;
}

function limiter(limit: number) {
  let windowEnd = 0;
  let windowCount = 0;
  return () => {
    if (world.now() >= windowEnd) {
      // start new window
      windowCount = 0
      windowEnd = world.now() + 1000
    }

    if (windowCount >= limit) {
      return true
    }

    windowCount++;
    return false;
  }
}

class ServerWithRateLimit implements Server {
  public requests: number;
  public failed: number;
  public succeeded: number;
  private isRateLimited: () => boolean;

  constructor(
    public rateLimit = 100,
  ) {
    this.requests = 0;
    this.failed = 0;
    this.succeeded = 0;
    this.isRateLimited = limiter(rateLimit);
  }

  handleRequest = () => {
    this.requests++;

    if (this.isRateLimited()) {
      this.failed++;
      return false;
    }

    this.succeeded++;
    return true;
  }
}



interface Client {
  makeRequest(sampler: Sampler, remoteFn: () => boolean): void;
}

class ClientWithBackoff implements Client{
  constructor(
    public backoff: RetryFn,
  ) {

  }

  makeRequest(sampler: Sampler, serverFn: () => boolean) {
    // Retry our simulated network request until it succeeds. Uses recursion instead of a loop because
    // our simulation of setTimeout() is not async.
    const backoffRequest = (retries: number) => {
      // This is our simulated network request.
      // console.log('client', retries);
      const success = serverFn();
      sampler.push(world.now(), 1);

      if (success) {
        return;
      }

      if (retries > 100) {
        console.log('Too many retries');
        return;
      }

      world.setTimeout(this.backoff(retries), () => {
        backoffRequest(retries + 1);
      });
    };

    backoffRequest(0);
  }
}



interface SimulationOpts {
  requestCount?: number;
}

function scenario(label: string, clients: Client[], server: Server, _opts: SimulationOpts = {}) {
  return () => {
    const sampler = new Sampler(1_000);

    world.run(() => {
      for (let client of clients) {
        client.makeRequest(sampler, server.handleRequest);
      }
    });

    return {
      label,
      samples: sampler.collect(),
      time: world.now(),
      requests: server.requests,
    };
  };
}

function make<T>(n: number, fn: () => T): T[] {
  const list: T[] = [];
  for (let i = 0; i < n; i++) {
    list.push(fn());
  }
  return list;
}

const scenarios = [
  scenario(
    'Limit 10/s; half jitter; center bias',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 0.5, jitterRandomize: 'each' }))),
    new ServerWithRateLimit(10),
  ),
  scenario(
    'Limit 10/s; full jitter',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterBias: 0, jitterRandomize: 'each' }))),
    new ServerWithRateLimit(10),
  ),
  scenario(
    'Limit 10/s; full jitter; fixed random',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterBias: 0, jitterRandomize: 'once' }))),
    new ServerWithRateLimit(10),
  ),

  scenario(
    'Limit 100/s; half jitter',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 0.5, jitterRandomize: 'each' }))),
    new ServerWithRateLimit(100),
  ),
  scenario(
    'Limit 100/s; full jitter; center bias',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterRandomize: 'each' }))),
    new ServerWithRateLimit(100),
  ),
  scenario(
    'Limit 100/s; full jitter',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterBias: 0, jitterRandomize: 'each' }))),
    new ServerWithRateLimit(100),
  ),
  scenario(
    'Limit 100/s; full jitter; fixed random',
    make(1000, () => new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterBias: 0, jitterRandomize: 'once' }))),
    new ServerWithRateLimit(100),
  ),
];

function fnum(n: number) {
  const f = new Intl.NumberFormat();
  return f.format(n);
}

scenarios
  .map((fn) => fn())
  .map((result) => ({
    ...result,
    dist: dist(result.samples, [0.95, 0.5, 0.05]),
  }))
  .forEach((result) => {
    // const plot = asciichart.plot(result.samples, {
    //   height: 20,
    // });
    
    const lines = [
      result.label,
      `\tRequests: ${fnum(result.requests)}`,
      `\tp95: ${fnum(result.dist[0])}`,
      `\tp50: ${fnum(result.dist[1])}`,
      `\tp5:  ${fnum(result.dist[2])}`,
    ];
    console.log(lines.join('\n') + '\n');
  });
