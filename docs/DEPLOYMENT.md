# Deployment (free tiers)

## 1. MongoDB Atlas
Create a free M0 cluster, a database user, and allow network access (0.0.0.0/0 for Render's changing IPs, or Render's outbound IPs). Copy the connection string into `MONGODB_URI`. Organization registration uses a transaction, so a replica set is required (Atlas has this).

## 2. Backend on Render
- New Web Service from the repo, root directory `backend`.
- Build: `npm install && npm run build`. Start: `npm start`.
- Environment: `NODE_ENV=production`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (generate with the command in `.env.example`), `CLIENT_URL` (your Vercel URL, no trailing slash), optional Cloudinary vars, `ENABLE_SLA_JOB`, `SLA_WARNING_MINUTES`.
- Health check path: `/api/v1/health`.
- The free tier sleeps after inactivity. The SLA job only runs while the service is awake. Use an uptime pinger on `/api/v1/health` or a paid instance if escalation timing matters.

## 3. Frontend on Vercel
- Root directory `frontend`, framework Vite.
- Environment: `VITE_API_URL=https://<your-render-app>.onrender.com/api/v1`.
- `vercel.json` already rewrites all routes to `index.html` for React Router.

## 4. Cookies and CORS
Frontend and API are on different domains, so the refresh cookie must be `Secure` and `SameSite=None` in production, and CORS must allow credentials from exactly `CLIENT_URL`. Check `auth.controller.ts` cookie options and `app.ts` CORS config match your setup. If login works but refresh fails after a page reload, this is the first place to look. Some browsers block third-party cookies; a shared custom domain (app.example.com / api.example.com) avoids that.

## 5. Seed demo data (optional)
`cd backend && npm run seed` (use `-- --reset` to wipe the demo org first). Demo org slug `demo-org`, password `Demo1234`. It is clearly fake data; do not present it as real usage.

## Limitations
No email provider (reset links appear in server logs), attachments need Cloudinary, SLA job lives in the API process.
