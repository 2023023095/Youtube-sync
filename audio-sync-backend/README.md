# Audio Sync Backend (Vercel)

This folder contains backend-only API routes.

## Deploy backend only
1. In Vercel, create/import project using this `audio-sync-backend` folder as root.
2. Add env vars:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Deploy.

## Local test
- Install dependencies: `npm install`
- Run local Vercel API: `npm run dev`

API routes:
- `POST /api/create-room`
- `POST /api/join-room`
- `GET /api/room`
- `POST /api/load-youtube`
- `POST /api/load-audio`
- `POST /api/control`
