import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ override: true });

// Ensure AI proxy uses server-side key
let ai: GoogleGenAI | null = null;
const getAi = () => {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not defined");
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ error: "API key not found. Please set GEMINI_API_KEY in the platform settings." });
      }
      
      const aiInstance = getAi();
      const payload = { ...req.body };
      
      // Default to a safe model if none provided
      if (!payload.model) {
        payload.model = "gemini-3-flash-preview";
      }

      console.info(`Proxying Gemini request for model: ${payload.model}`);
      const response = await aiInstance.models.generateContent(payload);
      
      res.json(response);
    } catch (err: any) {
      console.error("Gemini proxy error:", err);
      const statusCode = err.status || 500;
      res.status(statusCode).json({ error: err.message || "Internal server error" });
    }
  });

  app.get("/api/proxy-sheet", async (req, res) => {
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

  // API 404 catch-all
  app.all("/api/*", (req, res) => {
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
