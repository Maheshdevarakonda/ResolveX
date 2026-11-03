# ResolveX API Documentation

Base URL: `/api/v1`. Every response: `{ success, message, data, meta? }`; errors: `{ success: false, message, errors? }`.

Protected routes need the header `Authorization: Bearer <accessToken>`.

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{ status, uptimeSeconds, database }` |

## Auth (`/auth`)

The refresh token is never in a JSON body. It travels in the `refreshToken` httpOnly cookie (path `/api/v1/auth`).
Login needs `organizationSlug` because the same email may exist in different organizations.

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/register-org` | none | `organizationName, organizationSlug, name, email, password` | 201 `{ user, accessToken }` + cookie. Creates organization + ADMIN in one transaction |
| POST | `/auth/register` | none | `organizationSlug, name, email, password` | 201 `{ user, accessToken }` + cookie. Role is always CUSTOMER |
| POST | `/auth/login` | none | `organizationSlug, email, password` | 200 `{ user, accessToken }` + cookie |
| POST | `/auth/refresh` | cookie | none | 200 new `{ user, accessToken }` + rotated cookie |
| POST | `/auth/logout` | cookie | none | 200, session revoked, cookie cleared |
| GET | `/auth/me` | Bearer | none | 200 `{ user }` |

Password rules: 8-72 characters, at least one letter and one number.

Errors: 400 validation, 401 bad/expired token or credentials ("Invalid credentials" for every login failure), 403 deactivated account or wrong role, 404 unknown organization, 409 duplicate slug/email, 429 rate limit.

Token lifetimes: access 15 minutes, refresh 7 days. Each refresh token works once; reusing an old one revokes the whole login session.

| POST | `/auth/forgot-password` | none | `organizationSlug, email` | 200 with a generic message whether or not the account exists. The reset link is only written to the server log (no email provider) |
| POST | `/auth/reset-password` | none | `token, password` | 200. Token is single-use, expires in 30 minutes, and all sessions are revoked |

## Organization (`/organization`) - ADMIN only

The organization is always the caller's own (taken from the token). There is no organization id in any URL, and any `organizationId` sent in a body or query string is ignored.

| Method | Path | Body / Query | Success |
|---|---|---|---|
| GET | `/organization` | none | `{ organization: { id, name, slug, isActive, settings, createdAt } }` |
| PATCH | `/organization` | `name?`, `settings.allowCustomerRegistration?`, `settings.reopenWindowDays?` (1-90) | updated `{ organization }`. Slug cannot be changed. 400 if no valid field is sent |
| GET | `/organization/members` | `page` (default 1), `limit` (default 20, max 100), `role?` | `data: SafeUser[]`, `meta: { page, limit, total, totalPages }` |
| GET | `/organization/members/:userId` | none | `{ user }`. 404 if the user is in another organization, 400 if the id is malformed |

Setting `allowCustomerRegistration` to false makes `POST /auth/register` return 403 for that organization.

## Departments (`/departments`)

| Method | Path | Roles | Body | Success |
|---|---|---|---|---|
| GET | `/departments` | ADMIN, EMPLOYEE | none | `data: Department[]` sorted by name (no pagination; an organization has few) |
| POST | `/departments` | ADMIN | `name` (2-80), `description?` | 201 `{ department }`. 409 if the name exists (case-insensitive) |
| PATCH | `/departments/:id` | ADMIN | `name?`, `description?` | `{ department }`. 404 if not in your organization |
| DELETE | `/departments/:id` | ADMIN | none | 200. 409 if employees still belong to it. 404 if not in your organization |

## Users (`/users`)

| Method | Path | Roles | Body / Query | Success |
|---|---|---|---|---|
| PATCH | `/users/me` | any logged-in role | `name` | `{ user }`. Only the name is writable |
| POST | `/users/employees` | ADMIN | `name, email, password, departmentId?` | 201 `{ user }` (role always EMPLOYEE). 409 duplicate email, 404 department not in your organization |
| GET | `/users` | ADMIN | `page, limit, role?, departmentId?, isActive?, q?` | `data: SafeUser[]`, `meta`. `q` searches name or email (literal text, case-insensitive) |
| GET | `/users/:id` | ADMIN | none | `{ user }`. 404 for another organization's user |
| PATCH | `/users/:id` | ADMIN | `name?`, `departmentId?` (null clears; employees only), `isActive?` | `{ user }`. Deactivating revokes all refresh tokens. Admins cannot deactivate themselves |

`GET /organization/members` (Phase 4) overlaps with `GET /users`; it can be removed later.


## Complaints (`/complaints`)

Visibility: CUSTOMER sees own complaints; EMPLOYEE sees assigned ones plus unassigned OPEN ones; ADMIN sees all in the organization. Anything outside your scope returns 404.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/complaints/stats` | any | Counts for the caller's scope |
| POST | `/complaints` | CUSTOMER | `title, description, category, priority`. Creates ticket `RX-000001` style number and SLA deadlines |
| GET | `/complaints` | any | Query: `status, priority, category, departmentId, assignedTo, isEscalated, q, sort (newest/oldest/due), page, limit` |
| GET | `/complaints/:id` | any in scope | Detail including history |
| PATCH | `/complaints/:id/assign` | ADMIN | `employeeId` |
| POST | `/complaints/:id/accept` | EMPLOYEE | Claim an unassigned OPEN complaint. Second claimant gets 409 |
| PATCH | `/complaints/:id/status` | ADMIN, EMPLOYEE | `status` (IN_PROGRESS or RESOLVED), `note` required for RESOLVED. Invalid transition returns 409 |
| POST | `/complaints/:id/close` | ADMIN, CUSTOMER | Only from RESOLVED |
| POST | `/complaints/:id/reopen` | CUSTOMER | Only from RESOLVED and inside the organization's reopen window. Restarts the SLA clock |
| GET / POST | `/complaints/:id/comments` | in scope | `body`, optional `isInternal` (staff only) |
| POST | `/complaints/:id/attachments` | in scope | multipart `files` (max 5, 5 MB each, PNG/JPEG/WebP/PDF). 503 if Cloudinary is not configured |
| GET / POST | `/complaints/:id/feedback` | CUSTOMER submits once after RESOLVED/CLOSED | `rating` 1-5, `comment?` |

Status flow: OPEN > ASSIGNED > IN_PROGRESS > RESOLVED > CLOSED, plus RESOLVED > REOPENED > IN_PROGRESS. Escalation is a flag (`isEscalated`), not a status.

## Notifications (`/notifications`)

List (paginated), mark one read, mark all read, unread count. Real time: Socket.IO connection with the access token in the handshake `auth.token`; the server joins the user to their own room and emits `notification`.

## SLA policies (`/sla-policies`) - ADMIN

GET returns the four priorities (minutes). PUT saves them (5 to 43200 minutes; resolution >= response). Changes affect new complaints only.

## Analytics (`/analytics`) - ADMIN

`/summary`, `/by-department`, `/trends?days=7|30|90`, `/workload`. Rates are `null` (not 0) when there is no data.

## Audit logs (`/audit-logs`) - ADMIN

Paginated, filter by `action`, `from`, `to`, `complaintId`. Read-only.

## Feedback (`/feedback`) - ADMIN

Paginated list of all feedback in the organization.

## Multi-tenancy rules

1. Every organization-owned document has `organizationId`.
2. The tenant id comes only from `req.user` (verified token + database), never from client input.
3. Services build queries with `tenantFilter(orgId)` spread last.
4. A record from another tenant is reported as 404, never 403.
