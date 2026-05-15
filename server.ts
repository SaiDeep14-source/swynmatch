import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ override: true });

const cleanEnvValue = (val: string | undefined) => {
  if (!val) return "";
  return val.trim().replace(/^["'](.*)["']$/, '$1').trim();
};

const app = express();
const PORT = Number(process.env.PORT || 3000);
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

const postJsonWithTimeout = async (url: string, body: unknown, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } finally {
    clearTimeout(timeout);
  }
};

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

const extractGeminiText = (data: any) => {
  if (typeof data?.text === "string") return data.text;
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => part?.text || "").join("");
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
      return res.status(400).json({ error: "Gemini API key not found. Set GEMINI_API_KEY in your deployment environment." });
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

    const model = normalizeGeminiModel(payload.model);

    console.info(`Calling Gemini: ${model}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const upstream = await postJsonWithTimeout(url, toGeminiRestBody(payload), 30000);
    const responseText = await upstream.text();
    let data: any = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: { message: responseText || "Gemini returned a non-JSON response." } };
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || `Gemini API returned ${upstream.status}`,
        details: data
      });
    }
    
    return res.status(200).json({
      text: extractGeminiText(data),
      usageMetadata: data.usageMetadata,
      candidates: data.candidates
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

// Mount API routes before static assets.
app.use("/api", apiRouter);

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

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

export default app;
export { app };
