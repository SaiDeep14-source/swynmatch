import { getGeminiApiKey, normalizeGeminiModel, postJsonWithTimeout, readJsonBody, sendJson } from "../_shared";

const toGeminiRestBody = (payload: any) => {
  const body: any = { ...payload };
  delete body.model;

  if (typeof body.contents === "string") {
    body.contents = [
      {
        role: "user",
        parts: [{ text: body.contents }]
      }
    ];
  }

  if (body.config) {
    body.generationConfig = {
      ...(body.generationConfig || {}),
      ...body.config
    };
    delete body.config;
  }

  return body;
};

const extractText = (data: any) => {
  if (typeof data?.text === "string") return data.text;
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => part?.text || "").join("");
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const payload = await readJsonBody(req);
    const model = normalizeGeminiModel(payload.model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`;

    const upstream = await postJsonWithTimeout(url, toGeminiRestBody(payload), 30000);
    const responseText = await upstream.text();
    let data: any = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: { message: responseText || "Gemini returned a non-JSON response." } };
    }

    if (!upstream.ok) {
      return sendJson(res, upstream.status, {
        error: data?.error?.message || `Gemini API returned ${upstream.status}`,
        details: data
      });
    }

    return sendJson(res, 200, {
      text: extractText(data),
      usageMetadata: data.usageMetadata,
      candidates: data.candidates
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
