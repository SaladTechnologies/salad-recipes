import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.1.0/index.js";

// Test configuration
export const options = {
  scenarios: {
    ramp_up_users: {
      // Ramp up from 10 to 18 users over 15 minutes
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "15m", target: 10 },
        { duration: "35m", target: 35 },
        { duration: "15m", target: 35 },
      ],
    },
  },
};

// Custom metrics
const inputTokensTrend = new Trend("inputTokens");
const outputTokensTrend = new Trend("outputTokens");

// Request configuration
const { SALAD_API_KEY, ACCESS_DOMAIN_NAME, SAVE_IMAGES } = __ENV;

const url = `${ACCESS_DOMAIN_NAME}/api/generate`;

const payload = JSON.stringify({
  model: "llama3.1:8b",
  prompt: "Write a recipe for a salad",
  stream: false,
  options: {
    temperature: 0.5,
    num_predict: 1024
  }
});

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

  // Make the request
  const response = http.post(url, payload, params);

  const body = JSON.parse(response.body);
  const { prompt_eval_count: inputTokens, eval_count: outputTokens } = body;
  
  inputTokensTrend.add(inputTokens, { requestId: params.tags.requestId } );
  outputTokensTrend.add(outputTokens, { requestId: params.tags.requestId } );

  check(response, {
    "status is 200": (r) => r.status === 200,
  });
}
