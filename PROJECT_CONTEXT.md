# PROJECT_CONTEXT - ResolveX

## State: feature-complete code, UNVERIFIED
Everything below is written. Nothing has been installed, type-checked, built or run (sandbox had no npm access). Test counts, coverage and all performance numbers are unknown; see docs/PERFORMANCE_REPORT.md placeholders.

## Decisions
- Shared-DB multi-tenancy, tenant from req.user only, 404 across tenants.
- Customers self-register via /o/:slug/register. Employees are created by admins.
- Cloudinary for attachments (optional). Password reset link is logged, no email.
- Access token in memory (15m), refresh in httpOnly cookie (7d, hashed, rotated, reuse revokes family).
- Complaint states: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, REOPENED; escalation is a flag.
- SLA job: node-cron in the API process, every minute.
- Audit and notifications are best-effort. Some files (audit/notification services) came from an earlier context and were merged; some models were rewritten afterwards.

## Next steps for the owner
1. `npm install`, `npm run typecheck`, `npm test` in backend and frontend; fix what fails.
2. Seed, run `npm run explain`, k6, Lighthouse; fill docs/PERFORMANCE_REPORT.md.
3. Deploy per docs/DEPLOYMENT.md; verify the refresh cookie works cross-domain.
4. Update resume bullets only with measured numbers.
