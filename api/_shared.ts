import { GoogleGenAI } from "@google/genai";

export const cleanEnvValue = (val: string | undefined) => {
  if (!val) return "";
  return val.trim().replace(/^["'](.*)["']$/, "$1").trim();
};

export const sendJson = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

export const readJsonBody = async (req: any) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};

export const DEFAULT_GEMINI_MODEL = cleanEnvValue(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
const LEGACY_OR_INVALID_GEMINI_MODELS = new Set(["gemini-pro", "gemini-3-pro"]);

export const normalizeGeminiModel = (model: unknown) => {
  const requestedModel = typeof model === "string" ? model.trim() : "";
  if (!requestedModel || LEGACY_OR_INVALID_GEMINI_MODELS.has(requestedModel)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return requestedModel;
};

let ai: GoogleGenAI | null = null;

export const getGeminiClient = () => {
  if (!ai) {
    const key = cleanEnvValue(process.env.GEMINI_API_KEY);
    if (!key) {
      throw Object.assign(new Error("Gemini API key not found in platform settings."), { status: 400 });
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
};

export const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "User-Agent": "swynmatch-sheet-proxy/1.0"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
};
