# SWYNMATCH

SWYNMATCH is a React + Express app. It needs a normal Node.js server because the app uses backend routes for Google Sheet sync and Gemini calls.

## Local Setup

Prerequisite: Node.js 20 or newer.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and fill in the values:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open:
   ```text
   http://localhost:3000
   ```

## Production Deployment

Use a Node hosting platform such as Render, Railway, Fly.io, Heroku, DigitalOcean App Platform, or a VPS.

Build command:
```bash
npm install && npm run build
```

Start command:
```bash
npm start
```

The server listens on `process.env.PORT` when your host provides it, otherwise it uses port `3000`.

## Required Environment Variables

Set these before running `npm run build` so Vite can bake the Firebase client config into the frontend:

```env
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Set this for the backend at runtime:

```env
GEMINI_API_KEY=
```

## Health Checks

After deployment, check:

```text
/api/health
/api/proxy-sheet?id=1TO0fGH8KaFw0iX-Xn_aFkSLV7O461y_zimoWVByKrjk
/match
```

Expected results:
- `/api/health` returns JSON.
- `/api/proxy-sheet?...` returns CSV.
- `/match` returns the app HTML.

If `/api/gemini/generateContent` fails, confirm `GEMINI_API_KEY` is set in the deployment environment and that the key has Gemini API access.
