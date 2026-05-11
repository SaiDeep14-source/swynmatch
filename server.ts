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

// Debug env loading
console.info("Environment Check:");
const rawKey = process.env.GEMINI_API_KEY;
console.info("- GEMINI_API_KEY:", rawKey ? `PRESENT (starts with ${rawKey.substring(0, 4)}...)` : "MISSING");
console.info("- FIREBASE_PROJECT_ID:", process.env.VITE_FIREBASE_PROJECT_ID ? "PRESENT" : "MISSING");

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic request logger
  app.use((req, res, next) => {
    console.info(`${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // Global error handler for JSON parsing errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.error("Malformed JSON detected:", err.message);
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    next();
  });

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

  /**
   * Universal Gemini Proxy
   * Using 'handle' nomenclature to satisfy "handle function isnt declared" report
   */
  const handle = async (req: express.Request, res: express.Response) => {
    console.info(`Incoming Gemini Request: ${req.method} ${req.url}`);
    try {
      const key = cleanEnvValue(process.env.GEMINI_API_KEY);
      if (!key) {
        console.error("Gemini API key missing in environment");
        return res.status(400).json({ error: "Gemini API key (GEMINI_API_KEY) not found in platform settings." });
      }
      
      const aiInstance = getGeminiClient();
      const payload = { ...req.body };
      
      // Default to a safe model if none provided
      if (!payload.model || payload.model === "gemini-2.5-flash") {
        payload.model = "gemini-3-flash-preview";
      }

      console.info(`Proxying Gemini request for model: ${payload.model}`);
      const response = await aiInstance.models.generateContent(payload);
      
      // EXPLICIT Extraction: Getters like .text are NOT serialized by res.json()
      // We must explicitly extract them to ensure the client receives the data.
      res.json({
        text: response.text,
        usageMetadata: response.usageMetadata,
        candidates: response.candidates // Full raw response if needed
      });
    } catch (err: any) {
      console.error("Gemini proxy error:", err);
      const statusCode = err.status || 500;
      res.status(statusCode).json({ 
        error: err.message || "Internal AI Proxy Error",
        details: err.toString()
      });
    }
  };

  apiRouter.post("/gemini/generateContent", handle);
  // Support both versions
  apiRouter.post("/gemini/generateContent/", handle);


  apiRouter.get("/proxy-sheet", async (req, res) => {
    const sheetId = req.query.id as string;
    const gid = req.query.gid as string;
    if (!sheetId) return res.status(400).json({ error: "Missing sheet ID" });

    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
      console.info(`Proxying request to: ${url}`);
      
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Google Sheets API returned ${response.status} for ${sheetId}.` });
      }
      
      if (contentType && contentType.includes("text/html")) {
        return res.status(401).json({ 
          error: "Permission denied. The Google Sheet must be shared as 'Anyone with the link can view'." 
        });
      }

      const csvText = await response.text();
      res.send(csvText);
    } catch (err: any) {
      console.error('Proxy Error:', err);
      res.status(500).json({ error: "Network error fetching spreadsheet: " + err.message });
    }
  });

  // Mount API router
  app.use("/api", apiRouter);

  // API 404 catch-all
  app.all("/api/*", (req, res) => {
    console.warn(`404 on API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Ensure SPA fallback works in dev if vite middleware falls through
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
