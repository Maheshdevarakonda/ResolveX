// k6 load test for the ResolveX API.
//
// Prerequisites: API running + seeded demo data (npm run seed).
// Run:   k6 run -e BASE_URL=http://localhost:5000 k6/load-test.js
// Cloud: k6 run -e BASE_URL=https://<your-render-app>.onrender.com k6/load-test.js
//
// It does NOT contain any results. Record real numbers in docs/PERFORMANCE_REPORT.md
// together with: machine/instance, dataset size, VUs and test duration.
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:5000";
const ORG = __ENV.ORG || "demo-org";
const PASSWORD = __ENV.PASSWORD || "Demo1234";
const errors = new Rate("errors");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  // Pass/fail targets for the run. Adjust to what YOUR environment should achieve; do not
  // quote them as results.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    errors: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// Login is rate limited (20 / 15 min per IP), so we log in ONCE and share the token between VUs.
export function setup() {
  const res = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ organizationSlug: ORG, email: __ENV.EMAIL || "admin@demo.com", password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  if (res.status !== 200) throw new Error(`Login failed (${res.status}). Did you run "npm run seed"?`);
  return { token: res.json("data.accessToken") };
}

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };

  group("complaint list (paginated)", () => {
    const r = http.get(`${BASE}/api/v1/complaints?status=IN_PROGRESS&limit=20`, params);
    errors.add(!check(r, { "200": (x) => x.status === 200 }));
  });
  group("complaint search", () => {
    const r = http.get(`${BASE}/api/v1/complaints?q=router&limit=20`, params);
    errors.add(!check(r, { "200": (x) => x.status === 200 }));
  });
  group("analytics summary (aggregation)", () => {
    const r = http.get(`${BASE}/api/v1/analytics/summary`, params);
    errors.add(!check(r, { "200": (x) => x.status === 200 }));
  });
  group("analytics by department (aggregation)", () => {
    const r = http.get(`${BASE}/api/v1/analytics/by-department`, params);
    errors.add(!check(r, { "200": (x) => x.status === 200 }));
  });
  group("health", () => {
    const r = http.get(`${BASE}/api/v1/health`);
    errors.add(!check(r, { "200": (x) => x.status === 200 }));
  });
  sleep(1);
}
