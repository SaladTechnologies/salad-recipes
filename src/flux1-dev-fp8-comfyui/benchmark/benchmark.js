import http from "k6/http";
import { check } from "k6";

// Test configuration
export const options = {
  scenarios: {
    ramp_up_users: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30m", target: 10 },
        { duration: "1m", target: 11 },
        { duration: "29m", target: 11 },
      ],
    },
  },
};

// Request configuration
const { SALAD_API_KEY, ACCESS_DOMAIN_NAME, SAVE_IMAGES } = __ENV;

const saveImages = SAVE_IMAGES === "true";
const url = `${ACCESS_DOMAIN_NAME}/workflow/text2img`;

const payload = JSON.stringify({
  input: {
    prompt: "a leafy green spaceship from the distant future",
  },
});

// Default function that will be called for each virtual user
export default function () {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: '100s',
    discardResponseBodies: !saveImages,
  };

  if (SALAD_API_KEY) {
    params.headers["Salad-Api-Key"] = SALAD_API_KEY;
  }

  // Make the request
  const response = http.post(url, payload, params);

  // Check if request was successful
  check(response, {
    "status is 200": (r) => r.status === 200,
  });

  if (response.status === 200 && saveImages) {
    try {
      const data = JSON.parse(response.body);
      if (data.images && data.images[0]) {
        /**
         * We log out the image so we can capture and save it to a file if we want to.
         */
        console.log(`IMAGE_DATA: ${data.images[0]}`);
      }
    } catch (e) {
      console.error("Failed to parse response body");
    }
  }
}
