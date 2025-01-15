import http from "k6/http";
import { check } from "k6";
import encoding from "k6/encoding";

// Test configuration
export const options = {
  scenarios: {
    ramp_up_users: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30m", target: 10 },
        { duration: "30m", target: 20 },
      ],
    },
  },
};

// Request configuration
const { SALAD_API_KEY, ACCESS_DOMAIN_NAME } = __ENV;

const url = `${ACCESS_DOMAIN_NAME}/prompt`;

const prompt = JSON.parse(open("./prompt.json"));
const image = open("./image.png", "b");
prompt["78"].inputs.image = encoding.b64encode(image);

function getPrompt() {
  const copy = JSON.parse(JSON.stringify(prompt));
  copy["72"].inputs.noise_seed = Math.floor(Math.random() * 1000000);
  return copy;
}

// Default function that will be called for each virtual user
export default function () {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: "100s",
    discardResponseBodies: true,
  };

  if (SALAD_API_KEY) {
    params.headers["Salad-Api-Key"] = SALAD_API_KEY;
  }

  // Make the request
  const response = http.post(
    url,
    JSON.stringify({ prompt: getPrompt() }),
    params
  );

  // Check if request was successful
  check(response, {
    "status is 200": (r) => r.status === 200,
  });

  if (response.status !== 200) {
    console.error(`Error: ${response.status} - ${response.body}`);
  }
}
