const fs = require("fs/promises");

const rawResultsFile = "results.jsonl";
const outputResultsFile = "results.json";

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
