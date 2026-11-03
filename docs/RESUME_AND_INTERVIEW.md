# Resume bullets and interview prep

Fill every [X] only with numbers you measured (see PERFORMANCE_REPORT.md). Delete a bullet rather than invent a number.

## Resume bullets
- Built ResolveX, a multi-tenant complaint and service management platform (React, TypeScript, Node/Express, MongoDB) with customer, employee and admin roles enforced on the backend.
- Designed tenant isolation: tenant id derived only from the verified user, enforced in every query, with integration tests proving cross-tenant reads and writes return 404.
- Implemented JWT auth with rotating hashed refresh tokens in httpOnly cookies and reuse detection that revokes the session family.
- Modeled the complaint lifecycle as a state machine with atomic conditional updates to prevent double assignment and invalid transitions under concurrency.
- Added SLA tracking with a scheduled job that escalates overdue complaints exactly once, plus real-time notifications over Socket.IO.
- Built admin analytics (MongoDB aggregation pipelines) and an immutable audit log.
- Added compound indexes and verified them with `explain()`; [X]x fewer documents examined on [query] ([N] seeded complaints). [fill after running `npm run explain`]
- Load tested with k6: p95 [X] ms at [N] virtual users. [fill after running]
- Wrote [N] backend integration tests and [N] frontend tests. [fill after running]

## Interview questions to be ready for
1. How do you guarantee one tenant cannot see another's data? (tenant from token + DB, `tenantFilter`, 404 not 403, tests)
2. Why short access tokens and rotating refresh tokens? What happens if a refresh token is stolen? (reuse detection)
3. How do you stop two employees claiming the same complaint? (conditional findOneAndUpdate, 409)
4. Why is escalation a flag and not a status? (a complaint can be in progress and escalated)
5. What breaks if you run two API instances? (SLA job runs twice; safe due to atomic update; mention a queue)
6. Why regex search and what would you change? (text index / Atlas Search)
7. What did you not finish or not measure? (email provider, load numbers until you run them)
