import { sendJson } from "./_shared";

export default function handler(req: any, res: any) {
  return sendJson(res, 200, {
    status: "ok",
    time: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV,
      gemini: !!process.env.GEMINI_API_KEY,
      firebase: !!process.env.VITE_FIREBASE_PROJECT_ID
    }
  });
}
