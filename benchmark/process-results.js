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
const priceFile = process.argv[4] || "benchmark/prices.json";

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

function getHourlyPrice(priceMap, gpu, priority, vCPUs, memGB, maxNodes) {
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
}

function condenseRawData(k6Lines, nodeCountLines) {
  const allResults = k6Lines
    .map((line) => {
      if (!line) {
        return null;
      }
      return JSON.parse(line);
    })
    .filter(Boolean);

  const nodeResults = nodeCountLines
    .map((line) => {
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
    })
    .filter(Boolean);

  allResults.push(...nodeResults);

  const metrics = ["http_req_duration", "http_req_failed", "vus", "node_count", "inputTokens", "outputTokens"];
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

  return results;
}

function getPercentiles(data, percentiles) {
  const sortedData = data.toSorted((a, b) => a.value - b.value);
  return percentiles.map((p) => {
    const index = Math.floor(data.length * p);
    if (index === data.length) {
      return sortedData[index - 1].value;
    }
    return sortedData[index].value;
  });
}

function summarizeResults(results, prices, testConfig) {
  const durations = results.filter((r) => r.metric === "http_req_duration");
  const failedRequests = results.filter(
    (r) => r.metric === "http_req_failed" && r.value > 0
  );
  const vus = results.filter((r) => r.metric === "vus");

  const lengthOfBenchmarkSeconds = Math.max(
    ...results.map((r) => r.timeFromStart)
  ) / 1000;
  const numRequests = durations.length;
  const numFailedRequests = failedRequests.length;
  const successRate = (numRequests - numFailedRequests) / numRequests;

  const [minDurationSeconds, maxDurationSeconds, medianDurationSeconds, p90DurationSeconds] = getPercentiles(durations, [0, 1, 0.5, 0.9]).map((v) => v / 1000);
  const meanDurationSeconds = durations.reduce(
    (acc, val) => acc + val.value,
    0
  ) / durations.length / 1000;

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

  const meanThroughput = numRequests / lengthOfBenchmarkSeconds;
  const [p10Throughput, medianThroughput, maxThroughput] = getPercentiles(rollingThroughput, [0.1, 0.5, 1]);
  const timeOfMaxThroughputSeconds =
    rollingThroughput.find((r) => r.value === maxThroughput).timeFromStart / 1000;

  // Find the number of VUs at the time of max throughput. This should be done by seeking vus until time is greater than timeOfMaxThroughput, then taking the value before that
  const vusAtMaxThroughput =
    vus[
      vus.findIndex(
        (r) => r.timeFromStart / 1000 > timeOfMaxThroughputSeconds
      ) - 1
    ].value;

  const minVUs = Math.min(...vus.map((r) => r.value));
  const maxVUs = Math.max(...vus.map((r) => r.value));

  const vuTimeline = vus
    .filter((r, i) => vus[i - 1]?.value !== r.value)
    .map((r) => ({ ...r, timeFromStart: r.timeFromStart / 1000 }));

  const nodeResults = results.filter((r) => r.metric === "node_count");
  const minNodeCount = Math.min(...nodeResults.map((r) => r.value));
  const maxNodeCount = Math.max(...nodeResults.map((r) => r.value));
  const nodeCountFrequency = nodeResults.reduce((acc, val) => {
    const count = acc[val.value] || 0;
    acc[val.value] = count + 1;
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
  nodeCountMode.value = parseInt(nodeCountMode.value);
  const meanNodeCount = nodeResults.reduce(
    (acc, val) => acc + val.value,
    0
  ) / nodeResults.length;

  const priceMap = makePriceMap(prices);
  const gpuName = getGPUNameByID(
    prices,
    testConfig.container.resources.gpu_classes[0]
  ).toLowerCase();
  const hourlyCost = getHourlyPrice(
    priceMap,
    gpuName,
    "batch",
    testConfig.container.resources.cpu,
    testConfig.container.resources.memory / 1024,
    maxNodeCount
  );
  const [ medianCostPerRequest, meanCostPerRequest, minCostPerRequest ] = [medianThroughput, meanThroughput, maxThroughput].map((t) => hourlyCost / (t * 60 * 60));

  return {
    recipeName: path.basename(path.dirname(path.dirname(rawResultsFile))),
    resources: { ...testConfig.container.resources, gpu_classes: [gpuName] },
    lengthOfBenchmarkSeconds,
    numRequests,
    numFailedRequests,
    successRate,
    duration: {
      min: minDurationSeconds,
      median: medianDurationSeconds,
      mean: meanDurationSeconds,
      p90: p90DurationSeconds,
      max: maxDurationSeconds,
    },
    throughput: {
      p10: p10Throughput,
      median: medianThroughput,
      mean: meanThroughput,
      max: maxThroughput,
      timeAtMax: timeOfMaxThroughputSeconds,
      vusAtMax: vusAtMaxThroughput,
    },
    nodeCounts: {
      numSamples: nodeResults.length,
      min: minNodeCount,
      max: maxNodeCount,
      mode: nodeCountMode,
      mean: meanNodeCount,
    },
    vus: {
      min: minVUs,
      max: maxVUs,
    },
    cost: {
      perHour: hourlyCost,
      perRequest: {
        median: medianCostPerRequest,
        mean: meanCostPerRequest,
        min: minCostPerRequest,
      },
      requestsPerDollar: {
        median: 1 / medianCostPerRequest,
        mean: 1 / meanCostPerRequest,
        max: 1 / minCostPerRequest,
      }
    },
    vuTimeline,
  };
}

async function processResults() {
  const rawData = await fs.readFile(rawResultsFile, "utf-8");
  const rawLines = rawData.split("\n");

  const nodeCounts = await fs.readFile(nodeCountCSV, "utf-8");
  const nodeLines = nodeCounts.split("\n");

  const results = condenseRawData(rawLines, nodeLines);

  const testConfigContents = await fs.readFile(testConfigFile, "utf-8");
  const testConfig = JSON.parse(testConfigContents);

  const priceData = await fs.readFile(priceFile, "utf-8");
  const prices = JSON.parse(priceData);

  const smallResults = {
    resources: testConfig.container.resources,
    metric: results.map((r) => r.metric),
    timeFromStart: results.map((r) => r.timeFromStart),
    value: results.map((r) => r.value),
  };

  console.log(`Writing data to ${outputResultsFile}`);
  await fs.writeFile(outputResultsFile, JSON.stringify(smallResults));

  // Now we generate a summary that can be passed to an llm in order to generate
  // a blog post

  const summary = summarizeResults(results, prices, testConfig);
  console.log(`Writing summary to ${summaryFile}`);
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
  
}

processResults().catch((e) => {
  console.error(e);
  process.exit(1);
});
