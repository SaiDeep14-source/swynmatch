import { sendJson } from "./_shared";

export default function handler(req: any, res: any) {
  return sendJson(res, 200, {
    status: "ok",
    routes: [
      "/api/health",
      "/api/proxy-sheet?id={googleSheetId}",
      "/api/gemini/generateContent"
    ]
  });
}
