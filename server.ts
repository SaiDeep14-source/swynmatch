import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

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
  res.setHeader('Content-Type', 'application/json');
  try {
    const key = cleanEnvValue(process.env.GEMINI_API_KEY);
    if (!key) {
      console.error("Gemini API key missing in environment");
      return res.status(400).json({ error: "Gemini API key not found in platform settings." });
    }
    
    // Add debugging log for key format
    console.info(`[DEBUG] Gemini API key length: ${key.length}, starts with: ${key.substring(0, 4)}`);
    // Check for clear formatting issues
    if (key === "PLACEHOLDER" || key.length < 10) {
      return res.status(400).json({ error: "Invalid API key format in platform settings." });
    }
    
    // Ensure we handle JSON parsing errors if payload is weird
    const payload = req.body || {};
    
    // Check if parts are structured correctly
    if (payload.contents && Array.isArray(payload.contents)) {
      payload.contents.forEach((content: any) => {
        if (content.parts && Array.isArray(content.parts)) {
          // ensure valid text
        }
      });
    }

    const aiInstance = getGeminiClient();
    
    if (!payload.model) {
      payload.model = "gemini-2.5-flash";
    }

    console.info(`Calling Gemini: ${payload.model}`);
    
    // Add timeout handling to generateContent
    const PromiseTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API timeout exceeded (60s)")), 60000));
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
    let statusCode = 400; // use 400 to prevent proxy HTML error pages
    if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
      // 403 is often intercepted by reverse proxies (like nginx or Cloudflare) which return HTML.
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
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

apiRouter.post("/gemini/generateContent", handleGemini);
apiRouter.post("/gemini/generateContent/", handleGemini);

// Add an exact handler to the base app to bypass any router weirdness in Vercel
app.post("/api/gemini/generateContent", handleGemini);
app.post("/api/gemini/generateContent/", handleGemini);

apiRouter.get("/proxy-sheet", async (req, res) => {
  const sheetId = req.query.id as string;
  const gid = req.query.gid as string;
  if (!sheetId) return res.status(400).json({ error: "Missing sheet ID" });

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId.replace(/\s+/g, '')}/export?format=csv${gid ? `&gid=${gid.replace(/\s+/g, '')}` : ''}`;
    console.info(`Proxying Sheet: ${url}`);
    
    const response = await axios.get(url, { responseType: 'text', timeout: 15000 });
    const csvText = response.data;

    // Check if it's HTML (indicating a 404/auth page)
    if (typeof csvText === 'string' && csvText.trim().startsWith('<')) {
       return res.status(401).json({ error: "Sheet not public (Anyone with link can view required)" });
    }

    console.info(`Successfully fetched sheet length: ${csvText.length}`);
    res.send(csvText);
  } catch (err: any) {
    console.error(`[proxy-sheet] Error fetching sheet ${sheetId}. Message: ${err.message}`);
    
    if (err.response) {
      console.error(`[proxy-sheet] upstream status: ${err.response.status}`);
      // Explicitly handle Google Sheets 404 (Sheet not found or deleted)
      if (err.response.status === 404) {
        return res.status(404).json({ error: "Google Sheet not found. Please verify the URL and ensure the sheet still exists. (Status 404)" });
      }
      
      const status = err.response.status || 500;
      return res.status(status).json({ error: `Network error fetching sheet (Status: ${status})` });
    }
    
    return res.status(500).json({ error: "Internal error checking sheet: " + err.message });
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

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}

export default app;
export { app };
