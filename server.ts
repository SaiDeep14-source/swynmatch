import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { createServer as createViteServer } from "vite";

dotenv.config({ override: true });

const cleanEnvValue = (val: string | undefined) => {
  if (!val) return "";
  return val.trim().replace(/^["'](.*)["']$/, '$1').trim();
};

const app = express();
const PORT = 3000;

// --- Middlewares ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger
app.use((req, res, next) => {
  console.info(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ====================== GEMINI PROXY (CRITICAL FIX) ======================
const handleGemini = async (req: express.Request, res: express.Response) => {
  console.info(`Gemini Proxy Called: ${req.method} ${req.originalUrl}`);

  try {
    const key = cleanEnvValue(process.env.GEMINI_API_KEY);
    if (!key || key.length < 20) {
      return res.status(400).json({ error: "GEMINI_API_KEY is missing or invalid" });
    }

    const ai = new GoogleGenAI({ apiKey: key });
    let payload = req.body;

    if (!payload.model) payload.model = "gemini-2.5-flash";
    
    // Support string payloads natively to help avoid errors
    if (typeof payload.contents === 'string') {
        payload.contents = [{ role: 'user', parts: [{ text: payload.contents }] }];
    }

    const response = await ai.models.generateContent(payload) as any;

    res.json({
      text: response.text,
      usageMetadata: response.usageMetadata,
      candidates: response.candidates
    });

  } catch (err: any) {
    console.error("Gemini Error:", err);
    res.status(500).json({
      error: err.message || "Gemini API failed",
      details: err.toString()
    });
  }
};

// **High Priority Routes**
app.options(["/api/gemini/generateContent", "/api/gemini/generateContent/"], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

app.post(["/api/gemini/generateContent", "/api/gemini/generateContent/"], handleGemini);

// ====================== SHEET PROXY ======================
app.get(["/api/proxy-sheet", "/api/proxy-sheet/"], async (req, res) => {
  const sheetId = req.query.id as string;
  const gid = req.query.gid as string;

  if (!sheetId) return res.status(400).json({ error: "Missing sheet ID" });

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId.replace(/\s+/g, '')}/export?format=csv${gid ? `&gid=${gid.replace(/\s+/g, '')}` : ''}`;
    
    const response = await axios.get(url, { responseType: 'text', timeout: 15000 });
    const csvText = response.data;

    // Check if it's HTML (indicating a 404/auth page)
    if (typeof csvText === 'string' && csvText.trim().startsWith('<')) {
      return res.status(401).json({ error: "Sheet not public. Share as 'Anyone with the link can view'" });
    }

    res.send(csvText);
  } catch (err: any) {
    console.error("Proxy Sheet Error:", err.message);
    res.status(500).json({ error: "Failed to fetch sheet: " + err.message });
  }
});

// Health Check
app.get(["/api/health", "/api/health/"], (req, res) => {
  res.json({
    status: "ok",
    gemini: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString()
  });
});

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");

  // ====================== STATIC + SPA FALLBACK ======================
  if (process.env.NODE_ENV !== "production") {
    console.log("Running in development mode with Vite...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Could not start vite", e);
    }
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        if (req.originalUrl.startsWith('/api/')) {
          return res.status(404).json({ error: "API endpoint not found" });
        }
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server", err);
});

