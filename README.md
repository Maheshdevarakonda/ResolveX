# ResolveX

Multi-tenant Intelligent Complaint & Service Management Platform. Customers file complaints, employees resolve them, admins manage people, SLAs, analytics and audit logs. Each organization's data is isolated.

**Status:** all code is written, but it has NOT yet been installed, type-checked, built or run by the author (the build sandbox had no npm access). Treat the first `npm install && npm run typecheck && npm test` as the real verification and expect to fix small issues.

## Stack
Frontend: React 18, TypeScript, Vite, Tailwind, React Router, Axios, Recharts, React Hook Form, Vitest + Testing Library.
Backend: Node 20, Express, TypeScript, Mongoose/MongoDB, Zod, JWT, bcrypt, Helmet, rate limiting, Socket.IO, node-cron, Jest + Supertest + mongodb-memory-server.

## Run locally
```bash
# backend
cd backend && cp .env.example .env     # fill MONGODB_URI and the two JWT secrets
npm install
npm run typecheck && npm test
npm run seed                           # optional demo org: slug demo-org, password Demo1234
npm run dev                            # http://localhost:5000

# frontend (second terminal)
cd frontend && cp .env.example .env    # VITE_API_URL=http://localhost:5000/api/v1
npm install
npm run typecheck && npm test
npm run dev                            # http://localhost:5173
```
Performance tooling: `npm run explain` (query plans), `k6 run backend/k6/load-test.js`, Lighthouse on the production build. Results go in `docs/PERFORMANCE_REPORT.md`.

## Layout
```
backend/src/{config,middleware,models,modules,jobs,sockets,scripts,utils}
backend/tests  backend/k6
frontend/src/{api,components,context,layouts,pages,routes,utils}
docs/  API.md ARCHITECTURE.md DEPLOYMENT.md TROUBLESHOOTING.md PERFORMANCE_REPORT.md RESUME_AND_INTERVIEW.md
.github/workflows/ci.yml
```

## Known limitations
No email provider (reset links are logged by the API), attachments require Cloudinary, SLA job runs inside the API process (free hosting that sleeps pauses it), search is regex-based. See `docs/ARCHITECTURE.md`.

Never commit `.env` files or credentials.
