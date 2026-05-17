import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: "Deploy Error: Gemini API key is missing. Add GEMINI_API_KEY to your deployment environment variables." });
    }

    const ai = new GoogleGenAI({ apiKey: key });
    
    let payload = req.body;
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            return res.status(400).json({ error: "Invalid JSON format in request body." });
        }
    }
    
    if (!payload || !payload.contents) {
        return res.status(400).json({ error: "Invalid request payload. Expected 'contents' array." });
    }

    if (!payload.model) {
      payload.model = "gemini-2.5-flash";
    }

    const response = await ai.models.generateContent(payload) as any;

    return res.status(200).json({
      text: response.text,
      usageMetadata: response.usageMetadata,
      candidates: response.candidates
    });

  } catch (err: any) {
    console.error("Vercel AI Proxy Error:", err);
    let statusCode = 400;
    if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
      statusCode = err.status === 403 ? 400 : err.status;
    }
    
    let parsedErrorMsg = err.message || "Internal AI Proxy Error";
    try {
        if (typeof parsedErrorMsg === 'string' && parsedErrorMsg.startsWith('{')) {
            const temp = JSON.parse(parsedErrorMsg);
            if (temp.error && temp.error.message) {
                parsedErrorMsg = temp.error.message;
            }
        }
    } catch(e) {}

    return res.status(statusCode).json({ error: parsedErrorMsg, details: err.toString() });
  }
}
