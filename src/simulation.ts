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
      // console.log('proceeQueue', this.queue.toArray());
      const { runAtTime, fn } = this.queue.dequeue();
      this.time = runAtTime;
      fn();
    }
  }

  setTimeout(delay: number, fn: () => void) {
    this.queue.enqueue({ runAtTime: this.now() + delay, fn });
    // console.log('setTimeout', this.queue.toArray());
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

const world = new World();



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
    // console.log('limiter windowCount', windowCount);

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
    public rateLimit = 100
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
      // console.log('requests', world.now(), this.requests, this.failed, this.succeeded);
      return false;
    }

    this.succeeded++;
    // console.log('requests', world.now(), this.requests, this.failed, this.succeeded);
    // addSample(bucket(now()));

    return true;
  }
}



interface Client {
  makeRequest(remoteFn: () => boolean): void;
}

class ClientWithBackoff implements Client{
  constructor(
    public backoff: RetryFn,
  ) {

  }

  makeRequest(serverFn: () => boolean) {
    // Retry our simulated network request until it succeeds. Uses recursion instead of a loop because
    // our simulation of setTimeout() is not async.
    const backoffRequest = (retries: number) => {
      // This is our simulated network request.
      // console.log('client', retries);
      const success = serverFn();

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
  requestCount: number;
}

function prepareSim(opts: SimulationOpts, client: Client, server: Server) {
  return () => {
    world.run(() => {
      for (let i = 0; i < opts.requestCount; i++) {
        client.makeRequest(server.handleRequest);
      }
    });
    console.log('test complete', world.now(), server.requests, server.failed, server.succeeded);
  };
}



const tests = [
  // prepareTest(
  //   { requestCount: 100 },
  //   new ClientWithBackoff(exponentialBackoff({ jitterPercent: 0, jitterRandomize: 'each' })),
  //   new ServerWithRateLimit(1),
  // ),
  prepareSim(
    { requestCount: 1000 },
    new ClientWithBackoff(exponentialBackoff({ jitterPercent: 0.5, jitterRandomize: 'each' })),
    new ServerWithRateLimit(10),
  ),
  prepareSim(
    { requestCount: 1000 },
    new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterRandomize: 'each' })),
    new ServerWithRateLimit(10),
  ),
  // prepareTest(
  //   { requestCount: 100 },
  //   new ClientWithBackoff(exponentialBackoff({ jitterPercent: 0, jitterRandomize: 'each' })),
  //   new ServerWithRateLimit(10),
  // ),
  prepareSim(
    { requestCount: 1000 },
    new ClientWithBackoff(exponentialBackoff({ jitterPercent: 0.5, jitterRandomize: 'each' })),
    new ServerWithRateLimit(100),
  ),
  prepareSim(
    { requestCount: 1000 },
    new ClientWithBackoff(exponentialBackoff({ jitterPercent: 1, jitterRandomize: 'each' })),
    new ServerWithRateLimit(100),
  ),
];

// requests / rate limit
// 10 / 1     === requests 29,222    37   27   10
// 100 / 10   === requests 20,087   338  238  100
// 1000 / 100 === requests 19,574  3344 2344 1000

// 100 / 1    === requests 318,947  682  582  100

tests.forEach((test) => {
  test();
})
