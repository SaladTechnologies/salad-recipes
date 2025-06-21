import http from "k6/http";
import { check } from "k6";

// Test configuration
export const options = {
  scenarios: {
    ramp_up_users: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "15m", target: 10 },
        { duration: "30m", target: 25 },
        { duration: "15m", target: 25 },
      ],
    },
  },
};

// Environment variables
const { ACCESS_DOMAIN_NAME } = __ENV;
const url = `https://honeyberry-radicchio-sh0ebps0ahwkc9ci.salad.cloud/v2/models/flux-1-schnell-s-bs1-paged/infer`;

// Build JSON header
const jsonHeader = JSON.stringify({
  model_name: "flux-1-schnell-s-bs1-paged",
  inputs: [
    {
      name: "pos_prompt",
      datatype: "BYTES",
      shape: [1, 1],
      parameters: { binary_data_size: 18 }
    },
    {
      name: "seed",
      datatype: "UINT32",
      shape: [1, 1],
      parameters: { binary_data_size: 4 }
    }
  ],
  outputs: [
    { name: "image", parameters: { binary_data: true }},
    { name: "metadata", parameters: { binary_data: true }}
  ]
});

// Convert JSON header to bytes
const jsonBytes = [];
for (let i = 0; i < jsonHeader.length; i++) {
  jsonBytes.push(jsonHeader.charCodeAt(i));
}

// Build binary data for prompt (with 4-byte length prefix)
const prompt = "photo of a cat";
const promptLength = [
  prompt.length & 0xFF,
  (prompt.length >> 8) & 0xFF,
  (prompt.length >> 16) & 0xFF,
  (prompt.length >> 24) & 0xFF
];

const promptData = [];
for (let i = 0; i < prompt.length; i++) {
  promptData.push(prompt.charCodeAt(i));
}

// Build seed data (835 = 0x0343)
const seed = 835;
const seedData = [
  seed & 0xFF,
  (seed >> 8) & 0xFF,
  (seed >> 16) & 0xFF,
  (seed >> 24) & 0xFF
];

// Combine all byte arrays
const bodyBytes = [
  ...jsonBytes,
  ...promptLength,
  ...promptData,
  ...seedData
];

// Convert to ArrayBuffer for request
const body = new Uint8Array(bodyBytes).buffer;

// Default function
export default function () {
  const params = {
    headers: {
      "Content-Type": "application/octet-stream",
      "Inference-Header-Content-Length": String(jsonBytes.length),
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept": "*/*",
      "Connection": "keep-alive",
      "User-Agent": "python-requests/2.32.3"
    },
    timeout: '100s',
    discardResponseBodies: true
  };

  const response = http.post(url, body, params);

  // Check if request was successful
  check(response, {
    "status is 200": (r) => r.status === 200,
  });
}
