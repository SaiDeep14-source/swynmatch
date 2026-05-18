import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import axios from "axios";
import { promises as fs } from "fs";
import fsSync from "fs";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK
try {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  admin.initializeApp({
    credential,
    projectId: projectId
  });
} catch (e: any) {
  console.warn("Failed to initialize Firebase Admin with config:", e.message);
  // Fallback to ADC if available
  if (!admin.apps || admin.apps.length === 0) {
     try {
       admin.initializeApp();
     } catch(err) {
       console.warn("ADC fallback failed.");
     }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key_123!";
const EXPERTS_FILE = path.join(process.cwd(), "experts.json");
const SOURCES_FILE = path.join(process.cwd(), "sources.json");
const MATCH_HISTORY_FILE = path.join(process.cwd(), "match_history.json");
const USERS_FILE = path.join(process.cwd(), "users.json");

async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // Default to included user@swyn.in if no users.json file exists
      const hashedPassword = await bcrypt.hash("password", 10);
      return [
        {
          id: uuidv4(),
          email: "user@swyn.in",
          password: hashedPassword,
        },
      ];
    }
    throw err;
  }
}

async function writeUsers(users: any[]) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

async function readExperts() {
  try {
    const data = await fs.readFile(EXPERTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeExperts(experts: any[]) {
  await fs.writeFile(EXPERTS_FILE, JSON.stringify(experts, null, 2), "utf-8");
}

async function readSources() {
  try {
    const data = await fs.readFile(SOURCES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeSources(sources: any[]) {
  await fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2), "utf-8");
}

async function readMatchHistory() {
  try {
    const data = await fs.readFile(MATCH_HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeMatchHistory(history: any[]) {
  await fs.writeFile(
    MATCH_HISTORY_FILE,
    JSON.stringify(history, null, 2),
    "utf-8",
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: "*" } });

  const globalMessages: any[] = [];
  const privateMessages: any[] = [];

  io.on("connection", (socket) => {
    socket.on("join", (userEmail) => {
      socket.join("global_chat");
      if (userEmail) {
        socket.join(userEmail);
      }
    });
    
    socket.on("message", (data) => {
      const msg = {
        id: uuidv4(),
        user: data.user,
        text: data.text,
        timestamp: new Date().toISOString()
      };
      globalMessages.push(msg);
      if (globalMessages.length > 200) globalMessages.shift();
      io.to("global_chat").emit("message", msg);
    });

    socket.on("private_message", (data) => {
      const msg = {
        id: uuidv4(),
        user: data.user,
        recipient: data.recipient,
        text: data.text,
        timestamp: new Date().toISOString()
      };
      privateMessages.push(msg);

      io.to(data.recipient).emit("private_message", msg);
      if (data.user !== data.recipient) {
        io.to(data.user).emit("private_message", msg);
      }
    });
  });

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // JWT Middleware setup using Firebase Admin
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    
    if (!token) {
      console.warn(`Unauthorized request to ${req.path}: No token provided`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Ensure admin is initialized
      if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized");
      }
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (err: any) {
      console.error(`Firebase auth verification failed for ${req.path}:`, err.message);
      
      if (err.code === 'auth/id-token-expired') {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "Token expired", 
          code: 'auth/id-token-expired' 
        });
      }
      
      return res.status(403).json({ 
        error: "Forbidden", 
        message: err.message, 
        code: err.code || 'auth/invalid-token' 
      });
    }
  };

  // API Router setup
  const apiRouter = express.Router();

  // Public routes on the router (relative to /api)
  const publicApiPaths = ["/auth/login", "/auth/register", "/health", "/health/"];

  // API logging and authentication middleware
  apiRouter.use(async (req: any, res: any, next: any) => {
    try {
      console.log(`[API REQUEST] ${req.method} ${req.path}`);
      
      if (publicApiPaths.includes(req.path)) {
        return next();
      }

      await authenticateToken(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  // Health check
  apiRouter.get(["/health", "/health/"], (req, res) => {
    res.json({ status: "ok" });
  });

  apiRouter.get("/chat/history", async (req: any, res) => {
    const user = req.user.email;
    const userPrivates = privateMessages.filter((m: any) => m.user === user || m.recipient === user);
    res.json({
      global: globalMessages,
      private: userPrivates
    });
  });

  apiRouter.get("/users", async (req, res) => {
    try {
      const users = await readUsers();
      res.json(users.map((u: any) => ({ email: u.email })));
    } catch (err) {
      res.status(500).json({ error: "Failed to read users" });
    }
  });

  // AUTH ROUTES
  apiRouter.post("/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      if (!email.endsWith("@swyn.in")) {
        return res.status(400).json({ error: "Only @swyn.in email addresses are allowed to register" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
      }

      const users = await readUsers();
      if (users.find((u: any) => u.email === email)) {
        return res.status(400).json({ error: "User already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      users.push({ id: uuidv4(), email, password: hashedPassword });
      await writeUsers(users);
      res.json({ success: true, email });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  apiRouter.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const users = await readUsers();
      const user = users.find((u: any) => u.email === email);

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "24h",
      });
      res.json({ success: true, token, email: user.email });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  apiRouter.get("/matches/history", async (req, res) => {
    try {
      res.json(await readMatchHistory());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to read match history" });
    }
  });

  apiRouter.post("/matches/history", async (req, res) => {
    try {
      const matchRecord = req.body;
      const history = await readMatchHistory();
      const newRecord = {
        ...matchRecord,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      };
      history.unshift(newRecord);
      await writeMatchHistory(history);
      res.json({ success: true, id: newRecord.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save match history" });
    }
  });

  apiRouter.get("/experts", async (req, res) => {
    try {
      const experts = await readExperts();
      res.json(experts);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to read experts" });
    }
  });

  apiRouter.post("/experts", async (req, res) => {
    try {
      const expert = req.body;
      const experts = await readExperts();
      experts.push(expert);
      await writeExperts(experts);
      res.json(expert);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to add expert" });
    }
  });

  apiRouter.delete("/experts/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let experts = await readExperts();
      experts = experts.filter((e: any) => e.id !== id);
      await writeExperts(experts);
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete expert" });
    }
  });

  apiRouter.post("/experts/sync", async (req, res) => {
    try {
      const newExperts = req.body.experts;
      if (!Array.isArray(newExperts)) {
        return res.status(400).json({ error: "Missing or invalid experts array" });
      }
      const existingExperts = await readExperts();
      const updatedExperts = [...existingExperts, ...newExperts];
      await writeExperts(updatedExperts);
      res.json({ success: true, count: newExperts.length });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to sync experts" });
    }
  });

  apiRouter.get("/sources", async (req, res) => {
    try {
      res.json(await readSources());
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to read sources" });
    }
  });

  apiRouter.post("/sources", async (req, res) => {
    try {
      const { url } = req.body;
      const sources = await readSources();
      if (sources.some((s: any) => s.url === url)) {
        return res.status(400).json({ error: "URL already exists in sources" });
      }
      const newSource = {
        id: uuidv4(),
        url,
        lastSynced: new Date().toISOString(),
      };
      sources.push(newSource);
      await writeSources(sources);
      res.json(newSource);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to add source" });
    }
  });

  apiRouter.delete("/sources/:id", async (req, res) => {
    try {
      let sources = await readSources();
      sources = sources.filter((s: any) => s.id !== req.params.id);
      await writeSources(sources);
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  apiRouter.post("/sources/sync", async (req, res) => {
    try {
      const { sourceId } = req.body;
      const sources = await readSources();

      const sourcesToSync = sourceId
        ? sources.filter((s: any) => s.id === sourceId)
        : sources;

      if (sourcesToSync.length === 0) {
        return res.status(404).json({ error: "No sources to sync found" });
      }

      const syncTasks = sourcesToSync.map(async (source: any) => {
        const link = source.url;
        const match = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          const sheetId = match[1];
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

          try {
            console.log(`Syncing sheet: ${link}`);
            const response = await axios.get(exportUrl, {
              responseType: "text",
              timeout: 30000,
            });
            const csvData = response.data;

            const parsed = Papa.parse(csvData, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim().toLowerCase(),
            });
            
            const knownKeys = [
              "id", "name", "fullname", "full name", "expert", "role", "title", "job", "job title",
              "current job title / role", "current professional headline", "current / most recent role",
              "industry", "primary industry", "key sectors / industries", "sectors", "experience",
              "exp", "level", "years", "total years of experience", "total years of professional experience",
              "email", "personal email", "contact", "notes", "description", "bio", "brief professional bio",
              "please provide a brief biography / professional summary", "first name", "last name",
            ];

            const pExperts = parsed.data
              .map((row: any) => {
                const metadata: Record<string, any> = {};
                for (const key of Object.keys(row)) {
                   if (key && !knownKeys.includes(key.toLowerCase()) && row[key] !== "") {
                    metadata[key] = row[key];
                  }
                }

                let name = row.name || row.fullname || row["full name"] || row.expert || "";
                if (!name && row["first name"]) {
                  name = `${row["first name"]} ${row["last name"] || ""}`.trim();
                }
                if (!name) name = "Unknown";

                const role = row.role || row.title || row.job || row["job title"] || 
                             row["current job title / role"] || row["current professional headline"] || 
                             row["current / most recent role"] || "";
                
                const industry = row.industry || row["primary industry"] || 
                                row["key sectors / industries"] || row.sectors || "";

                const experience = row.experience || row.exp || row.level || row.years || 
                                  row["total years of experience"] || row["total years of professional experience"] || "";
                
                const email = (row.email || row["personal email"] || row.contact || "").trim().toLowerCase();
                
                const notes = row.notes || row.description || row.bio || row["brief professional bio"] || 
                             row["please provide a brief biography / professional summary"] || "";

                return {
                  id: row.id || uuidv4(),
                  name,
                  role,
                  industry,
                  experience,
                  email,
                  notes,
                  metadata,
                };
              })
              .filter((expert: any) => expert.name !== "Unknown");

            source.lastSynced = new Date().toISOString();
            source.status = "success";
            source.error = null;
            return pExperts;
          } catch (err: any) {
            console.error(`Failed to fetch sheet ${link}:`, err.message);
            source.status = "error";
            source.error = err.message;
            return [];
          }
        } else {
          source.status = "error";
          source.error = "Invalid Google Sheets URL format";
          return [];
        }
      });

      const results = await Promise.all(syncTasks);
      let allExperts: any[] = [];
      for (const resList of results) {
        allExperts = [...allExperts, ...resList];
      }

      const existingExperts = await readExperts();
      const updatedExperts = [...existingExperts];

      for (const ne of allExperts) {
        let idx = -1;
        if (ne.email) {
          idx = updatedExperts.findIndex((e) => e.email && e.email.toLowerCase() === ne.email.toLowerCase());
        } else {
          idx = updatedExperts.findIndex((e) => e.name.toLowerCase() === ne.name.toLowerCase());
        }

        if (idx !== -1) {
          updatedExperts[idx] = {
            ...updatedExperts[idx],
            ...ne,
            metadata: { ...updatedExperts[idx].metadata, ...ne.metadata },
          };
        } else {
          updatedExperts.push(ne);
        }
      }

      await writeExperts(updatedExperts);
      await writeSources(sources);

      res.json({ 
        success: true, 
        count: allExperts.length,
        sources: sourcesToSync.map((s: any) => ({ id: s.id, status: s.status, error: s.error }))
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to sync sources" });
    }
  });

  apiRouter.get("/proxy-cv", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing url" });

    try {
      let targetUrl = url;
      if (targetUrl.includes("docs.google.com/document/d/")) {
        const match = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          targetUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
        }
      }
      const response = await axios.get(targetUrl, {
        timeout: 10000,
        responseType: "text",
      });
      const text = response.data.substring(0, 5000);
      res.setHeader("Content-Type", "text/plain");
      res.send(text);
    } catch (err: any) {
      console.error("CV Fetch Error:", err.message);
      res.status(500).json({ error: "Failed to fetch CV text" });
    }
  });

  apiRouter.post("/match", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Missing query parameter" });
      }

      const experts = await readExperts();
      const { GoogleGenAI } = await import("@google/genai");

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set.");
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const simplifiedExperts = experts.map((e: any) => ({
        id: e.id,
        role: e.role,
        industry: e.industry,
        experience: e.experience,
        notes: e.notes ? e.notes.substring(0, 500) : "",
        metadata: e.metadata ? e.metadata : undefined, 
      })).slice(0, 200);

      const prompt = `You are a matching engine for finding the best professional experts based on a user's typed requirement.
You have a directory of experts (provided as JSON). Look at the user's requirement and determine the top 5 best matching experts from the provided list.
For each match, provide a match percentage (0 to 100), a reason why they are a good fit, and any gaps (missing skills, experience etc.) between their profile and the requirement.

User Requirement: "${query}"

Experts JSON: ${JSON.stringify(simplifiedExperts)}

Return only a JSON array of matches in the following format:
[
  {
    "id": "expert-uuid",
    "matchPercentage": 95,
    "matchReason": "Brief explanation why this expert matches",
    "gaps": "Briefly note any areas where they might not be a perfect fit"
  },
  ... up to 5 best matches
]

Return ONLY the raw JSON array. DO NOT wrap with markdown blocks like \`\`\`json.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const responseText = response.text || "[]";
      
      const cleanText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsedMatches = [];
      try {
        parsedMatches = JSON.parse(cleanText);
      } catch (parseErr) {
        console.error("AI returned malformed JSON:", cleanText);
        parsedMatches = [];
      }

      const finalMatches = parsedMatches
        .map((m: any) => {
          const expertData = experts.find((e: any) => e.id === m.id);
          if (expertData) {
            return {
              ...expertData,
              matchPercentage: m.matchPercentage || 0,
              matchReason: m.matchReason || "",
              gaps: m.gaps || "",
            };
          }
          return null;
        })
        .filter((m: any) => m !== null);

      res.json({ matches: finalMatches });
    } catch (err: any) {
      console.error("Match Engine error:", err.message);
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes("429") || errorMsg.includes("Quota exceeded")) {
         return res.status(429).json({ error: "Gemini API rate limit exceeded. Please wait a moment before trying again." });
      }
      res.status(500).json({ error: "Failed to perform matching" });
    }
  });

  // Catch-all for API to prevent falling through to HTML fallback
  apiRouter.all("*", (req, res) => {
    console.warn(`Unmatched API route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: "API route not found", 
      path: req.originalUrl 
    });
  });

  // Mount the API Router
  app.use("/api", apiRouter);

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Error Handler reached:", err);
    // Use originalUrl because req.path might be relative to the mount point
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(err.status || 500).json({
        error: "Internal Server Error",
        message: err.message,
        path: req.originalUrl
      });
    }
    next(err);
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, esbuild compiles to dist/server.cjs.
    // Wait, the dist directory layout:
    // /dist/index.html
    // /dist/assets/...
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
