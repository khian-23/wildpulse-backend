# WildPulse Backend Deployment

NestJS API for WildPulse (`/api` prefix), designed for MongoDB Atlas + Cloudinary.

## Required Environment Variables

Set these in Railway (or your host):

- `PORT` (Railway injects this automatically)
- `MONGODB_URI`
- `DEVICE_MASTER_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `JWT_SECRET` (if auth endpoints use it)

Optional:

- `NODE_ENV=production`

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: `New Project` -> `Deploy from GitHub Repo`.
3. Select this backend repo.
4. Railway uses `Dockerfile` and deploys automatically.
5. Add all required environment variables.
6. Open your service URL and verify:

```bash
curl https://<your-backend-domain>/api/health
```

## Notes

- Server binds to `0.0.0.0` and uses `process.env.PORT` (fallback `3000`).
- CORS is enabled for web dashboard access.
- Command queue is currently capture-only (`capture_now`).
