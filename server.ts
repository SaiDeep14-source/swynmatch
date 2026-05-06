import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Ensure AI proxy uses server-side key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      const response = await ai.models.generateContent(req.body);
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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
