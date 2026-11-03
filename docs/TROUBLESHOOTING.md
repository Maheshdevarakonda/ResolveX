# Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits on start with env validation error | A required variable is missing in `backend/.env`. Compare with `.env.example` |
| `MongoServerSelectionError` | Wrong `MONGODB_URI`, or Atlas network access does not include your IP |
| Org registration fails with a transaction error | MongoDB is a standalone server. Use Atlas or a local replica set |
| Browser CORS error | `CLIENT_URL` must exactly match the frontend origin (no trailing slash) |
| Logged out on page refresh in production | Refresh cookie blocked: check Secure/SameSite=None and CORS credentials; see DEPLOYMENT.md |
| 401 loops in the browser | Clear site data; check that `VITE_API_URL` points to `/api/v1` |
| Attachment upload returns 503 | Cloudinary variables not set |
| Reset email never arrives | By design: the link is printed in the API log |
| Escalations not happening on Render free | Service is asleep; see DEPLOYMENT.md |
| Backend tests hang the first time | `mongodb-memory-server` downloads a MongoDB binary on first run; needs internet |
| `npm run typecheck` errors | This code has not been compiled by the author. Report or fix the listed lines; most are likely small typing issues on Mongoose update operators |
