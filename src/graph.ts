const Chartist = require('chartist');
const chartistSvg = require('chartist-svg');
import { ExponentialBackoffOpts, RetryFn, exponentialBackoff } from ".";

// scenarios:
// - once
// - each
// - 100%
// - 50%

function scenario1() {
  const backoff = exponentialBackoff({
    start: 1_000,
    ceiling: 10_000,
    jitterRandomize: 'each',
  });

  const samples = runMonteCarlo(backoff, {});
  // console.log('Samples', samples);
  renderGraph(samples).then((graph) => {
    console.log(graph);
  });
}

interface MonteCarloOpts {
  trials?: number;
  bucketSize?: number;
  trialTimeLimit?: number
}

function runMonteCarlo(fn: RetryFn, { trials = 100, bucketSize = 1_000, trialTimeLimit = 60_000 * 1 }: MonteCarloOpts) {
  const samples = new Map<number, number>();
  const r = Number

  for (let i = 0; i < trials; i++) {
    let retries = 0;
    let time = 0;
    while (true) {
      time += fn(retries++);
      // console.log('Trial step', i, retries, time);
      if (time > trialTimeLimit || retries > 10) {
        break;
      }
      const bucket = Math.floor(time / bucketSize) * bucketSize;
      samples.set(bucket, (samples.get(bucket) ?? 0) + 1);
    }
  }

  return samples;
}

function renderGraph(samples: Map<number, number>): Promise<string> {
  var data = {
    title: 'Time to play PUBG',
    subtitle: 'Player Unknown\'s Battleground',
    labels: [...samples.keys()],
    series: [
      [...samples.values()],
    ]
  };

  var options = {
    css: '.ct-chart-line .ct-series .ct-point { stroke: green; }',
    chart: {lineSmooth: Chartist.Interpolation.step()},
  };

  return chartistSvg('line', data, options);
}

scenario1();
