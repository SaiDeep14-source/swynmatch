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
  
  app.get("/api/health", (req, res) => {
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
   */
  const handleGemini = async (req: express.Request, res: express.Response) => {
    console.info(`Gemini Proxy Triggered: ${req.method} ${req.url}`);
    try {
      const key = cleanEnvValue(process.env.GEMINI_API_KEY);
      if (!key) {
        console.error("Gemini API key missing in environment");
        return res.status(400).json({ error: "Gemini API key not found in platform settings." });
      }
      
      const aiInstance = getGeminiClient();
      const payload = { ...req.body };
      
      // Default model handling
      if (!payload.model || payload.model.includes("gemini-1.5") || payload.model === "gemini-2.5-flash") {
        payload.model = "gemini-3-flash-preview";
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
      const statusCode = err.status || 500;
      res.status(statusCode).json({ 
        error: err.message || "Internal AI Proxy Error",
        details: err.toString()
      });
    }
  };

  // Register directly on app to avoid router mounting issues
  app.post("/api/gemini/generateContent", handleGemini);
  app.post("/api/gemini/generateContent/", handleGemini);

  app.get("/api/proxy-sheet", async (req, res) => {
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

  // API 404 handler
  app.use("/api/*", (req, res) => {
    console.warn(`API Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Resource not found" });
  });

  // Trigger production mode if we are running the 'start' script
  const distHtmlPath = path.join(process.cwd(), "dist/index.html");
  const isProduction = process.env.NODE_ENV === "production" && fs.existsSync(distHtmlPath);
  
  if (isProduction) {
    console.info("Server started in PRODUCTION mode");
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("WARNING: NODE_ENV is set to production but dist/index.html is missing. Falling back to development mode if possible.");
    }
    console.info("Server started in DEVELOPMENT mode");
  }

  // Vite middleware for development
  if (!isProduction) {
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
    console.info(`Serving static files from: ${distPath}`);
    
    app.use(express.static(distPath));
    
    // Handle SPA fallback for client-side routing
    app.get("*", (req, res) => {
      // If it's a request for an API route that reached here, it's a 404
      if (req.originalUrl.startsWith('/api/')) {
        console.warn(`API Not Found (in prod catch-all): ${req.method} ${req.url}`);
        return res.status(404).json({ error: "API route not found" });
      }
      
      if (fs.existsSync(distHtmlPath)) {
        res.sendFile(distHtmlPath);
      } else {
        console.error(`ERROR: dist/index.html not found even though in production mode! Path: ${distHtmlPath}`);
        res.status(500).send("Production build missing. Please rebuild the application.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
