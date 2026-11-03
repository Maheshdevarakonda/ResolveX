# ResolveX Architecture

```
React (Vite) --HTTPS/JSON--> Express API --Mongoose--> MongoDB Atlas
      \--Socket.IO (notifications)--/        \--node-cron SLA job (in process)
                                              \--Cloudinary (attachments, optional)
```

## Multi-tenancy
Shared database, shared collections. Every org-owned document has `organizationId`. The tenant comes only from `req.user` (verified JWT plus a DB lookup on every request), never from client input. Queries spread `tenantFilter(orgId)` last so it cannot be overridden. Cross-tenant access returns 404 so ids cannot be probed. Tests in `backend/tests/tenantIsolation.test.ts` cover this.

## Auth
Access token 15 min (kept in memory in the browser). Refresh token 7 days in an httpOnly cookie scoped to `/api/v1/auth`, stored hashed, rotated on every use; reuse of an old token revokes the whole family. Login uses organization slug + email + password, a dummy bcrypt compare and a generic error to avoid user enumeration.

## Complaint lifecycle
OPEN > ASSIGNED > IN_PROGRESS > RESOLVED > CLOSED, plus RESOLVED > REOPENED > IN_PROGRESS. Transitions use a conditional `findOneAndUpdate` that includes the current status, so two concurrent requests cannot both win. Employees "accept" unassigned complaints with the same atomic pattern.

## SLA
Per-priority response and resolution minutes. A cron job (every minute) escalates overdue complaints exactly once (`isEscalated:false` is in the update filter) and sends a one-time warning before the deadline. Reopening restarts the clock.

## Realtime
`notify()` stores a Notification row and emits to the `user:<id>` Socket.IO room. The client refreshes lists on a window event.

## Known deviations and trade-offs (be upfront about these in interviews)
- Search uses a case-insensitive regex, not a text index. Fine at demo scale; a text or Atlas Search index is the upgrade path.
- Complaint creation is not wrapped in a transaction (ticket counter + insert). A failure could skip a ticket number, never duplicate one.
- Audit logging and notifications are best-effort: failure is logged and does not fail the user's request.
- The SLA job runs in the API process. With several instances it would run on each (the atomic update keeps it safe but wasteful). A queue or leader lock is the next step.
- No email provider: password reset links are logged on the server only.
- Attachments need Cloudinary credentials, otherwise upload returns 503.
