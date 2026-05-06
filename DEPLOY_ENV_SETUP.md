# Environment Setup for Deployment

This guide explains how to set up your environment variables when deploying the app outside of AI Studio.

## Why use an `.env` file?
Storing configuration in an `.env` file prevents sensitive keys or environment-specific configuration from being hardcoded into the source code repository. 

For Firebase, the client configuration is technically public as it is bundled into the client-side JavaScript, but it is a best practice to extract it into `.env` so you can smoothly deploy separate environments (e.g. staging vs. production Firebase projects) without editing code. 

**Note**: Your `GEMINI_API_KEY` is fully secret and runs gracefully server-side in this app. It must be kept secure.

## Setup Steps

1. Create a file named `.env` in the root of your project directory.
2. Copy the contents of `.env.example` into `.env`.
3. Fill in the values for the environment variables based on your external platforms (Google AI Studio and Firebase Console).

### Required Keys

#### Gemini API Key (Server-side)
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
Find your API key in Google AI Studio or Google Cloud Console. This key is used securely by `server.ts` to execute AI model generation requests.

#### Firebase Configuration (Client-side)
In your Firebase Console, navigate to Project settings > General. Scroll down to your web app's configurations and copy the keys to your `.env` file. These values use the `VITE_` prefix so the Vite bundler can expose them to your client application during the build process.

```env
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_ID=your_firestore_database_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Server Execution & Cloud Providers
If you're deploying to Vercel, Heroku, Cloud Run, Cloudflare Pages, or Render:

1. Look for the "Environment Variables" or "Secrets" section in their project dashboard.
2. Add `GEMINI_API_KEY` with your AI Studio key.
3. Add the `VITE_FIREBASE_*` variables. Since the frontend is built using Vite, these keys must be present **during the build step** so Vite can bake them into `dist/`.

By providing the `.env` variables, the app will prioritize them over the default fallback `firebase-applet-config.json` bindings automatically.
