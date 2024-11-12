const fs = require("fs/promises");
const path = require("path");

const usage = `
Usage: process-results.js <raw-results-file> [output-results-file]

  raw-results-file: The file containing the raw results from the k6 run, in JSON Lines format
  [output-results-file]: The file to write the processed results to. Defaults to results.json in the same directory as the raw-results-file
`

const rawResultsFile = process.argv[2];

if (!rawResultsFile) {
  console.error(usage);
  process.exit(1);
}

const parentDir = path.dirname(rawResultsFile);
const outputResultsFile = process.argv[3] || path.join(parentDir, "results.json");

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

  const metrics = ["checks", "http_req_duration", "http_req_failed", "vus"];
  const results = allResults
    .filter(
      (result) =>
        result.type === "Point" &&
        result.metric &&
        metrics.includes(result.metric)
    )
    .map((result) => {
      return {
        ...result,
        data: {
          ...result.data,
          time: new Date(result.data.time),
        },
      };
    });

  // Sort by .data.time
  results.sort((a, b) => a.data.time - b.data.time);

  const firstTime = results[0].data.time;
  results.forEach((result) => {
    result.data.timeFromStart = result.data.time - firstTime;
    delete result.data.time;
  });

  console.log(`Processed ${results.length} results`);
  await fs.writeFile(outputResultsFile, JSON.stringify(results, null, 2));
}

processResults();
