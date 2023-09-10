const asciichart = require('asciichart');
// const Recorder = require('sample-distribution');
import { ExponentialBackoffOpts, RetryFn, exponentialBackoff } from ".";

interface SampleDistributionRecorder {
  push: (value: unknown) => void;
  Q: (q: number) => number;
}

function run() {
  const baseOpts: ExponentialBackoffOpts = {
    start: 1_000,
    ceiling: 10_000,
    jitterRandomize: 'each',
  };

  const scenarios = [
    exponentialBackoff({
      ...baseOpts,
      jitterPercent: 0.5,
      jitterBias: 0,
    }),
    exponentialBackoff({
      ...baseOpts,
      jitterPercent: 1,
      jitterBias: 0,
    }),
    exponentialBackoff({
      ...baseOpts,
      jitterPercent: 1,
      jitterBias: 1,
    }),
    exponentialBackoff({
      ...baseOpts,
      jitterPercent: 1,
      jitterBias: 0,
      jitterRandomize: 'once',
    }),
  ];

  scenarios
    .map(runMonteCarlo({ sampleLimit: process.stdout.columns - 20 }))
    .map(renderAscii)
    .forEach(output);
}

interface MonteCarloOpts {
  trials?: number;
  bucketSize?: number;
  sampleLimit?: number;
}

interface MonteCarloResult {
  samples: number[];
  maxTime: number;
  requests: number;
  bucketSize: number;
  // dist: SampleDistributionRecorder;
}

function runMonteCarlo({ trials = 100, bucketSize = 300, sampleLimit = 160 }: MonteCarloOpts) {
  return (fn: RetryFn): MonteCarloResult => {
    const samples = new Map<number, number>();
    let maxTime = 0;
    let maxBucket = 0;
    let requests = 0;

    for (let i = 0; i < trials; i++) {
      let retries = 0;
      let time = 0;
      while (true) {
        time += fn(retries++, i);
        const bucket = Math.floor(time / bucketSize) * bucketSize;
        if (bucket / bucketSize > sampleLimit) {
          break;
        }
        samples.set(bucket, (samples.get(bucket) ?? 0) + 1);
        maxTime = Math.max(maxTime, time);
        maxBucket = Math.max(maxBucket, bucket);
        requests++;
      }
    }

    // Fill in the holes.
    for (let bucket = 0; bucket < sampleLimit * bucketSize; bucket += bucketSize) {
      if (!samples.has(bucket)) {
        samples.set(bucket, 0);
      }
    }

    // Sort by time.
    const entries = [...samples.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);

    return { samples: entries, maxTime, requests, bucketSize };
  };
}

function renderAscii(result: MonteCarloResult) {
  const plot = asciichart.plot(result.samples, {
    height: 20,
  });

  return `${plot}\nRequests: ${result.requests}`;
}

function output(plot: string, i: number) {
  console.log(`Scenario ${i + 1}\n`)
  console.log(plot);
  console.log('\n');
}

run();
