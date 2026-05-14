import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ override: true });

const cleanEnvValue = (val: string | undefined) => {
  if (!val) return "";
  return val.trim().replace(/^["'](.*)["']$/, '$1').trim();
};

// Ensure AI proxy uses server-side key
let ai: GoogleGenAI | null = null;
const getGeminiClient = () => {
  if (!ai) {
    const key = cleanEnvValue(process.env.GEMINI_API_KEY);
    if (!key) {
      console.error("FATAL: GEMINI_API_KEY is not defined in environment.");
      throw new Error("GEMINI_API_KEY is not defined. Please set it in platform settings.");
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
};

const app = express();
const PORT = 3000;

// --- Pre-route Middlewares ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic request logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.info(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * Universal Gemini Proxy
 */
const handleGemini = async (req: express.Request, res: express.Response) => {
  console.info(`Gemini Proxy Triggered: ${req.method} ${req.originalUrl}`);
  try {
    const key = cleanEnvValue(process.env.GEMINI_API_KEY);
    if (!key) {
      console.error("Gemini API key missing in environment");
      return res.status(400).json({ error: "Gemini API key not found in platform settings." });
    }
    
    const aiInstance = getGeminiClient();
    const payload = { ...req.body };
    
    if (!payload.model || payload.model.includes("gemini-1.5") || payload.model.includes("flash")) {
      payload.model = "gemini-3-pro";
    }

    console.info(`Calling Gemini: ${payload.model}`);
    const response = await aiInstance.models.generateContent(payload);
    
    res.json({
      text: response.text,
      usageMetadata: response.usageMetadata,
      candidates: response.candidates
    });
  } catch (err: any) {
    console.error("Gemini proxy logic error:", err);
    res.status(err.status || 500).json({ 
      error: err.message || "Internal AI Proxy Error",
      details: err.toString()
    });
  }
};

// --- API Routes ---
const apiRouter = express.Router();

apiRouter.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    time: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV,
      gemini: !!process.env.GEMINI_API_KEY,
      firebase: !!process.env.VITE_FIREBASE_PROJECT_ID
    }
  });
});

apiRouter.post("/gemini/generateContent", handleGemini);
apiRouter.post("/gemini/generateContent/", handleGemini);

apiRouter.get("/proxy-sheet", async (req, res) => {
  const sheetId = req.query.id as string;
  const gid = req.query.gid as string;
  if (!sheetId) return res.status(400).json({ error: "Missing sheet ID" });

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    console.info(`Proxying Sheet: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Google Sheets returned ${response.status}` });
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      return res.status(401).json({ error: "Sheet not public (Anyone with link can view required)" });
    }

    const csvText = await response.text();
    res.send(csvText);
  } catch (err: any) {
    console.error('Sheet Proxy Error:', err);
    res.status(500).json({ error: "Network error fetching sheet: " + err.message });
  }
});

// Mount the router at both root and /api to be safe
app.use("/api", apiRouter);
app.use("/", (req, res, next) => {
  // If it's a request intended for the API but path prefix was stripped (common in some rewrites)
  if (req.url.startsWith('/gemini/') || req.url.startsWith('/proxy-sheet') || req.url.startsWith('/health')) {
    return apiRouter(req, res, next);
  }
  next();
});

// API 404 handler - MUST be before Vite/Static fallback
app.all("/api/*", (req, res) => {
  console.warn(`API Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "API endpoint not found",
    details: `Route ${req.method} ${req.originalUrl} matches no handler.`
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");
  const distHtmlPath = path.join(distPath, "index.html");

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) return next();
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ error: "API 404" });
      if (fs.existsSync(distHtmlPath)) {
        res.sendFile(distHtmlPath);
      } else {
        res.status(500).send("Build artifacts missing.");
      }
    });
  }

  // Only listen if not in serverless (like Vercel)
  if (!process.env.VERCEL && !process.env.NOW_REGION) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

export default app;
export { app };
