import { getGeminiClient, normalizeGeminiModel, readJsonBody, sendJson } from "../_shared";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const payload = await readJsonBody(req);
    payload.model = normalizeGeminiModel(payload.model);

    const response = await Promise.race([
      getGeminiClient().models.generateContent(payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API timeout exceeded (30s)")), 30000))
    ]) as any;

    return sendJson(res, 200, {
      text: response.text,
      usageMetadata: response.usageMetadata,
      candidates: response.candidates
    });
  } catch (err: any) {
    let statusCode = 502;
    if (typeof err.status === "number" && err.status >= 400 && err.status < 600) {
      statusCode = err.status;
    }

    let message = err?.message || "Internal AI Proxy Error";
    try {
      if (typeof message === "string" && message.startsWith("{")) {
        const parsed = JSON.parse(message);
        message = parsed?.error?.message || message;
      }
    } catch {}

    return sendJson(res, statusCode, {
      error: message,
      details: String(err)
    });
  }
}
