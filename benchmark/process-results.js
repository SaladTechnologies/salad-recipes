const fs = require("fs/promises");
const path = require("path");

const usage = `
Usage: node benchmark/process-results.js <raw-results-file> [output-results-file] [price-file]

  raw-results-file: The file containing the raw results from the k6 run, in JSON Lines format
  [output-results-file]: The file to write the processed results to. Defaults to results.json in the same directory as the raw-results-file
  [price-file]: The file containing the prices for the resources used in the test. Defaults to benchmark/prices.json
`;

const rawResultsFile = process.argv[2];

if (!rawResultsFile) {
  console.error(usage);
  process.exit(1);
}

const outputResultsFile =
  process.argv[3] || rawResultsFile.replace(/\.jsonl?$/, ".json");

const summaryFile = rawResultsFile.replace(/\.jsonl?$/, "-summary.json");
const nodeCountCSV = rawResultsFile.replace(/\.jsonl?$/, "-node-count.csv");
const testConfigFile = rawResultsFile.replace(/\.jsonl?$/, "-test-config.json");
const priceFile = process.argv[4] || 'benchmark/prices.json';

const vCPUPrice = 0.004;
const memGBPrice = 0.001;

function getRollingAverage(data, period, metric) {
  const rolling = [];
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = i;
      j >= 0 && data[i].timeFromStart - data[j].timeFromStart < period;
      j--
    ) {
      sum += data[j][metric];
      count++;
    }
    rolling.push({
      timeFromStart: data[i].timeFromStart,
      [metric]: sum / count,
    });
  }
  return rolling;
}

function getGPUNameByID(prices, id) {
  return prices.items.find((item) => item.id === id).name;
}

function makePriceMap(prices) {
  const priceMap = {};
  for (const gpuObject of prices.items) {
    const gpuName = gpuObject.name.toLowerCase();
    priceMap[gpuName] = {};
    for (const priceObject of gpuObject.prices) {
      priceMap[gpuName][priceObject.priority] = parseFloat(priceObject.price);
    }
  }
  return priceMap;
}

const getHourlyPrice = (priceMap, gpu, priority, vCPUs, memGB, maxNodes) => {
  if (!priceMap[gpu]) {
    throw new Error(`Unknown GPU: ${gpu}`);
  }
  if (!priceMap[gpu][priority]) {
    throw new Error(`Unknown priority: ${priority}`);
  }
  const hourlyPrice =
    (parseFloat(priceMap[gpu][priority]) +
      vCPUs * vCPUPrice +
      memGB * memGBPrice) *
    maxNodes;
  return hourlyPrice;
};

async function processResults() {
  const rawData = await fs.readFile(rawResultsFile, "utf-8");
  const rawLines = rawData.split("\n");

  const nodeCounts = await fs.readFile(nodeCountCSV, "utf-8");
  const nodeLines = nodeCounts.split("\n");

  const testConfigContents = await fs.readFile(testConfigFile, "utf-8");
  const testConfig = JSON.parse(testConfigContents);

  const priceData = await fs.readFile(priceFile, "utf-8");
  const prices = JSON.parse(priceData);
  const priceMap = makePriceMap(prices);

  const allResults = rawLines
    .map((line) => {
      if (!line) {
        return null;
      }
      return JSON.parse(line);
    })
    .filter(Boolean);

  const nodeResults = nodeLines.map((line) => {
    if (!line) {
      return null;
    }
    const [time, count] = line.split(",");
    return {
      type: "Point",
      metric: "node_count",
      data: {
        time: new Date(time * 1000).toISOString(),
        value: parseInt(count),
      },
    };
  }).filter(Boolean);

  allResults.push(...nodeResults);

  const metrics = ["http_req_duration", "http_req_failed", "vus", "node_count"];
  const rawResults = allResults
    .filter(
      (result) =>
        result.type === "Point" &&
        result.metric &&
        metrics.includes(result.metric)
    )
    .sort((a, b) => new Date(a.data.time) - new Date(b.data.time));

  const firstTime = new Date(rawResults[0].data.time);
  const results = rawResults.map((result) => ({
    metric: result.metric,
    value: result.data.value,
    timeFromStart: new Date(result.data.time) - firstTime,
  }));

  const smallResults = {
    resources: testConfig.container.resources,
    metric: results.map((r) => r.metric),
    timeFromStart: results.map((r) => r.timeFromStart),
    value: results.map((r) => r.value),
  };

  // Now we generate a summary that can be passed to an llm in order to generate
  // a blog post
  const durations = results.filter((r) => r.metric === "http_req_duration");
  const failedRequests = results.filter(
    (r) => r.metric === "http_req_failed" && r.value > 0
  );
  const vus = results.filter((r) => r.metric === "vus");

  const lengthOfBenchmarkSeconds =
    (Math.max(...smallResults.timeFromStart) -
      Math.min(...smallResults.timeFromStart)) /
    1000;
  const numRequests = durations.length;
  const numFailedRequests = failedRequests.length;
  const successRate = (numRequests - numFailedRequests) / numRequests;

  const minDurationSeconds =
    durations.reduce((acc, val) => Math.min(acc, val.value), Infinity) / 1000;
  const maxDurationSeconds =
    durations.reduce((acc, val) => Math.max(acc, val.value), 0) / 1000;
  const meanDurationSeconds =
    durations.reduce((acc, val) => acc + val.value, 0) / (numRequests * 1000);
  const percentile90DurationSeconds =
    durations.map((r) => r.value).sort((a, b) => a - b)[
      Math.floor(numRequests * 0.9)
    ] / 1000;

  const throughputPeriod = 60 * 1000;
  const throughput = durations.map((d, i) => {
    const { timeFromStart } = d;
    const count = durations
      .slice(i)
      .filter((d) => d.timeFromStart - timeFromStart < throughputPeriod).length;
    return {
      timeFromStart,
      value: count / (throughputPeriod / 1000),
    };
  });
  const rollingThroughput = getRollingAverage(
    throughput,
    throughputPeriod,
    "value"
  );

  const avgThroughput = numRequests / lengthOfBenchmarkSeconds;
  const maxThroughput = Math.max(
    ...rollingThroughput.map((r) => r.value),
  );
  const timeOfMaxThroughputSeconds = rollingThroughput.find(
    (r) => r.value === maxThroughput,
  ).timeFromStart / 1000;
  
  // Find the number of VUs at the time of max throughput. This should be done by seeking vus until time is greater than timeOfMaxThroughput, then taking the value before that
  const vusAtMaxThroughput = vus[vus.findIndex((r) => r.timeFromStart / 1000 > timeOfMaxThroughputSeconds) - 1].value;

  const minVUs = Math.min(...vus.map((r) => r.value));
  const maxVUs = Math.max(...vus.map((r) => r.value));

  const vuTimeline = vus
    .filter((r, i) => vus[i - 1]?.value !== r.value)
    .map((r) => ({ ...r, timeFromStart: r.timeFromStart / 1000 }));

  const minnodeCount = Math.min(...nodeResults.map((r) => r.data.value));
  const maxnodeCount = Math.max(...nodeResults.map((r) => r.data.value));
  const nodeCountFrequency = nodeResults.reduce((acc, val) => {
    const count = acc[val.data.value] || 0;
    acc[val.data.value] = count + 1;
    return acc;
  }, {});
  const nodeCountMode = Object.entries(nodeCountFrequency).reduce(
    (acc, [value, count]) => {
      if (count > acc.count) {
        return { value, count };
      }
      return acc;
    },
    { value: null, count: 0 }
  );

  const gpuName = getGPUNameByID(prices, testConfig.container.resources.gpu_classes[0]).toLowerCase();
  const hourlyCost = getHourlyPrice(priceMap,  gpuName, "batch", testConfig.container.resources.cpu, testConfig.container.resources.memory / 1024, maxnodeCount);
  const bestCostPerRequest = hourlyCost / (maxThroughput * 60 * 60);
  const bestRequestsPerDollar = 1 / bestCostPerRequest;

  const summary = {
    recipeName: path.basename(path.dirname(path.dirname(rawResultsFile))),
    resources: {...testConfig.container.resources, gpu_classes: [gpuName]},
    lengthOfBenchmarkSeconds,
    numRequests,
    numFailedRequests,
    successRate,
    minDurationSeconds,
    maxDurationSeconds,
    meanDurationSeconds,
    percentile90DurationSeconds,
    avgThroughput,
    maxThroughput,
    timeOfMaxThroughputSeconds,
    vusAtMaxThroughput,
    minnodeCount,
    maxnodeCount,
    nodeCountMode: parseInt(nodeCountMode.value),
    minVUs,
    maxVUs,
    requestsPerDollar: bestRequestsPerDollar,
    hourlyCost,
    bestCostPerRequest,
    vuTimeline,
  };

  console.log(`Processed ${results.length} results`);
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
  await fs.writeFile(outputResultsFile, JSON.stringify(smallResults, null, 2));
}

processResults().catch((e) => {
  console.error(e);
  process.exit(1);
})
