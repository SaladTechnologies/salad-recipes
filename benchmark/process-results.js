const fs = require("fs/promises");
const path = require("path");

const usage = `
Usage: node benchmark/process-results.js <raw-results-file> [output-results-file]

  raw-results-file: The file containing the raw results from the k6 run, in JSON Lines format
  [output-results-file]: The file to write the processed results to. Defaults to results.json in the same directory as the raw-results-file
`;

const rawResultsFile = process.argv[2];

if (!rawResultsFile) {
  console.error(usage);
  process.exit(1);
}

const outputResultsFile =
  process.argv[3] || rawResultsFile.replace(/\.jsonl?$/, ".json");

const summaryFile = rawResultsFile.replace(/\.jsonl?$/, "-summary.json");

async function processResults() {
  const data = await fs.readFile(rawResultsFile, "utf-8");
  const lines = data.split("\n");

  const allResults = lines
    .map((line) => {
      if (!line) {
        return null;
      }
      return JSON.parse(line);
    })
    .filter(Boolean);

  const metrics = ["http_req_duration", "http_req_failed", "vus"];
  const rawResults = allResults
    .filter(
      (result) =>
        result.type === "Point" &&
        result.metric &&
        metrics.includes(result.metric)
    )
    .sort((a, b) => a.data.time - b.data.time);

  const firstTime = new Date(rawResults[0].data.time);
  const results = rawResults.map((result) => ({
    metric: result.metric,
    value: result.data.value,
    timeFromStart: new Date(result.data.time) - firstTime,
  }));

  const smallResults = {
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

  const minVUs = Math.min(...vus.map((r) => r.value));
  const maxVUs = Math.max(...vus.map((r) => r.value));

  const vuTimeline = vus
    .filter((r, i) => vus[i - 1]?.value !== r.value)
    .map((r) => ({ ...r, timeFromStart: r.timeFromStart / 1000 }));

  const summary = {
    lengthOfBenchmarkSeconds,
    numRequests,
    numFailedRequests,
    successRate,
    minDurationSeconds,
    maxDurationSeconds,
    meanDurationSeconds,
    percentile90DurationSeconds,
    minVUs,
    maxVUs,
    vuTimeline,
  };

  console.log(`Processed ${results.length} results`);
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
  await fs.writeFile(outputResultsFile, JSON.stringify(smallResults, null, 2));
}

processResults();
