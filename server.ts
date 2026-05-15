import express from "express";
import path from "path";
import fs from "fs";
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
const DEFAULT_GEMINI_MODEL = cleanEnvValue(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
const LEGACY_OR_INVALID_GEMINI_MODELS = new Set(["gemini-pro", "gemini-3-pro"]);

const normalizeGeminiModel = (model: unknown) => {
  const requestedModel = typeof model === "string" ? model.trim() : "";
  if (!requestedModel || LEGACY_OR_INVALID_GEMINI_MODELS.has(requestedModel)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return requestedModel;
};

const withTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "Accept": "text/csv,text/plain,*/*",
        "User-Agent": "swynmatch-sheet-proxy/1.0"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
};

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
  res.setHeader('Content-Type', 'application/json');
  try {
    const key = cleanEnvValue(process.env.GEMINI_API_KEY);
    if (!key) {
      console.error("Gemini API key missing in environment");
      return res.status(400).json({ error: "Gemini API key not found in platform settings." });
    }
    
    // Ensure we handle JSON parsing errors if payload is weird
    const payload = { ...(req.body || {}) };
    
    // Check if parts are structured correctly
    if (payload.contents && Array.isArray(payload.contents)) {
      payload.contents.forEach((content: any) => {
        if (content.parts && Array.isArray(content.parts)) {
          // ensure valid text
        }
      });
    }

    const aiInstance = getGeminiClient();
    
    payload.model = normalizeGeminiModel(payload.model);

    console.info(`Calling Gemini: ${payload.model}`);
    
    // Add timeout handling to generateContent
    const PromiseTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API timeout exceeded (30s)")), 30000));
    const response = await Promise.race([
      aiInstance.models.generateContent(payload),
      PromiseTimeout
    ]) as any;
    
    return res.status(200).json({
      text: response.text,
      usageMetadata: response.usageMetadata,
      candidates: response.candidates
    });
  } catch (err: any) {
    console.error("Gemini proxy logic error:", err);
    let statusCode = 502; // keep proxy errors as JSON while signalling upstream failure
    if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
      statusCode = err.status;
    } else if (typeof err.status === 'number' && err.status >= 500 && err.status < 600) {
      statusCode = err.status;
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
    
    return res.status(statusCode).json({ 
      error: parsedErrorMsg,
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
  const sheetId = String(req.query.id || "").trim();
  const gid = String(req.query.gid || "").trim();
  if (!sheetId) return res.status(400).json({ error: "Missing sheet ID" });
  if (!/^[a-zA-Z0-9-_]+$/.test(sheetId)) {
    return res.status(400).json({ error: "Invalid Google Sheet ID. Paste the spreadsheet URL or the ID from /spreadsheets/d/{id}." });
  }
  if (gid && !/^\d+$/.test(gid)) {
    return res.status(400).json({ error: "Invalid Google Sheet gid. It should be a numeric tab ID." });
  }

  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
    console.info(`Proxying Sheet: ${exportUrl}`);

    let upstream = await withTimeout(exportUrl, 15000);
    if (!upstream.ok && upstream.status >= 400) {
      console.warn(`Sheet export endpoint returned ${upstream.status}; trying gviz CSV fallback.`);
      upstream = await withTimeout(gvizUrl, 15000);
    }

    const csvText = await upstream.text();

    if (!upstream.ok) {
      const status = upstream.status === 404 ? 404 : 502;
      return res.status(status).json({
        error: upstream.status === 404
          ? "Google Sheet not found. Please verify the URL and ensure the sheet still exists."
          : `Google Sheets returned ${upstream.status}. Ensure the sheet is shared as "Anyone with the link can view".`
      });
    }

    // Check if it's HTML (indicating a 404/auth page)
    if (typeof csvText === 'string' && /^\s*</.test(csvText)) {
       return res.status(403).json({ error: "Sheet not public. Share the responses spreadsheet as \"Anyone with the link can view\" and sync again." });
    }

    console.info(`Successfully fetched sheet length: ${csvText.length}`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(csvText);
  } catch (err: any) {
    const message = err?.name === "AbortError" ? "Timed out fetching Google Sheet." : (err?.message || String(err));
    console.error('Sheet Proxy Error Object:', message);
    res.status(502).json({ error: "Network error fetching sheet: " + message });
  }
});

// Mount the router at both root and /api to be safe
app.use("/api", apiRouter);
app.use("/", (req, res, next) => {
  // Determine the actual intended URL. Vercel sometimes rewrites req.url to the destination.
  const vercelOriginalUrl = req.headers['x-now-route-matches'] || req.headers['x-vercel-id'] ? req.originalUrl : null;
  const targetUrl = vercelOriginalUrl || req.url;
  
  if (targetUrl.includes('/gemini/') || targetUrl.includes('/proxy-sheet') || targetUrl.includes('/health')) {
    // We need to rewrite req.url to strip '/api' so apiRouter matches correctly
    if (req.url.startsWith('/api/')) {
        req.url = req.url.replace('/api', '');
    }
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

let productionAssetsInstalled = false;
function installProductionAssets() {
  if (productionAssetsInstalled) return;
  productionAssetsInstalled = true;

  const distPath = path.join(process.cwd(), "dist");
  const distHtmlPath = path.join(distPath, "index.html");

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

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const distHtmlPath = path.join(distPath, "index.html");
  // Check both env var and presence of built output for safety
  const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod" || fs.existsSync(distHtmlPath);

  if (!isProduction) {
    let createViteServer;
    try {
      const vite = await import("vite");
      createViteServer = vite.createServer;
    } catch (e) {
      console.error("Vite not found, falling back to static production mode.", e);
      return;
    }
    
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
    
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) return next();
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await viteInstance.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    installProductionAssets();
  }

  // Bind to 0.0.0.0 and PORT completely indiscriminately so we don't accidentally skip listening
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  server.on('error', (e) => {
    console.error("Server bind error:", e);
  });
}

// Global unhandled handlers to prevent crashes from taking down server silently
process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (process.env.VERCEL) {
  installProductionAssets();
} else {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}

export default app;
export { app };
