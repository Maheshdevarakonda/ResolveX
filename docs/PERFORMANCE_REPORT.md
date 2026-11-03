# Performance Report (TEMPLATE - nothing here has been measured)

All values are `[TBD - not measured]` until you run the tools yourself. Do not put numbers on a resume that are not in this file with a real environment description.

## Environment
- Machine / host: [TBD]
- Node version: [TBD]
- MongoDB (Atlas tier / local): [TBD]
- Dataset: `npm run seed` with SEED_COMPLAINTS=[TBD] complaints

## 1. Query plans (`npm run explain`)
| Query | Indexed docs examined | Collection-scan docs examined | Indexed ms | Scan ms |
|---|---|---|---|---|
| (filled by the script) | [TBD] | [TBD] | [TBD] | [TBD] |

## 2. API load test (k6: `k6 run backend/k6/load-test.js`)
| Scenario | VUs | Duration | p50 | p95 | p99 | Error rate | Req/s |
|---|---|---|---|---|---|---|---|
| list complaints | [TBD] | [TBD] | [TBD] | [TBD] | [TBD] | [TBD] | [TBD] |
The thresholds in the script are targets, not results.

## 3. Frontend (Lighthouse on the production build)
| Page | Performance | Accessibility | Best practices | LCP |
|---|---|---|---|---|
| Landing | [TBD] | [TBD] | [TBD] | [TBD] |
| Login | [TBD] | [TBD] | [TBD] | [TBD] |

## 4. Test coverage (`npm run test:coverage`)
Backend: [TBD]%. Frontend: [TBD]%.

## Notes
Render free tier cold starts will dominate first-request latency; record warm and cold separately.
