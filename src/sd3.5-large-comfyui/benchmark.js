import http from "k6/http";
import { check } from "k6";


// Test configuration
export const options = {
  scenarios: {
    ramp_up_users: {
      // Ramp up from 10 to 18 users over 15 minutes
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "15m", target: 10 }, // Stay at 10 users for 15 minutes
        { duration: "15m", target: 18 }, // Ramp up to 18 users over 15 minutes
        { duration: "30m", target: 18 }, // Stay at 18 users for 30 minutes
      ],
    },
  }
};

// Request configuration
const { SALAD_API_KEY, API_URL } = __ENV;

const payload = JSON.stringify({
  input: {
    prompt: "a leafy green spaceship from the distant future",
    steps: 20,
  },
});

// Default function that will be called for each virtual user
export default function () {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (SALAD_API_KEY) {
    params.headers["Salad-Api-Key"] = SALAD_API_KEY;
  }

  // Make the request
  const response = http.post(API_URL, payload, params);

  // Check if request was successful
  check(response, {
    "status is 200": (r) => r.status === 200,
  });

  if (response.status === 200) {
    try {
      const data = JSON.parse(response.body);
      if (data.images && data.images[0]) {
        /**
         * We log out the image so we can capture and save it to a file
         */
        console.log(`IMAGE_DATA: ${data.images[0]}`);
      }
    } catch (e) {
      console.error("Failed to parse response body");
    }
  }
}

