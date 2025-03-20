import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.1.0/index.js";
import { SharedArray } from "k6/data";

// Test configuration
export const options = {
  scenarios: {
    ramp_up_users: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "59m", target: 300 },
      ],
    },
  },
};

// Custom metrics
const inputTokensTrend = new Trend("inputTokens");
const outputTokensTrend = new Trend("outputTokens");

const allPrompts = new SharedArray("samplePrompts", function () {
  return open("sample12b_5000.jsonl")
    .split("\n")
    .filter((prompt) => prompt)
    .map((prompt) => JSON.parse(prompt));
});

// Request configuration
const { SALAD_API_KEY, ACCESS_DOMAIN_NAME } = __ENV;

const url = `${ACCESS_DOMAIN_NAME}/v1/chat/completions`;

// Default function that will be called for each virtual user
export default function () {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: "100s",
    tags: {
      requestId: uuidv4(),
    },
  };

  if (SALAD_API_KEY) {
    params.headers["Salad-Api-Key"] = SALAD_API_KEY;
  }

  const prompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];

  const payload = JSON.stringify({...prompt, stream: false});

  // Make the request
  const response = http.post(url, payload, params);
  check(response, {
    "status is 200": (r) => r.status === 200,
  });

  let body;
  try {
    body = JSON.parse(response.body);
  } catch (e) {
    console.error("Failed to parse response body");
    console.error(e);
    console.error(response.body);
    return;
  }
  const inputTokens = body.usage.prompt_tokens;
  const outputTokens = body.usage.completion_tokens;
  const caption = JSON.stringify(body.choices[0].message.content);
  console.log(`${imageURL}|${caption}`);

  inputTokensTrend.add(parseInt(inputTokens), {
    requestId: params.tags.requestId,
  });
  outputTokensTrend.add(parseInt(outputTokens), {
    requestId: params.tags.requestId,
  });
}
