import express from "express";
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

  app.use(express.json());

  // JWT Middleware setup using Firebase Admin
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (err: any) {
      console.error("Firebase auth verification failed:", err.message);
      return res.status(403).json({ error: "Forbidden" });
    }
  };

  app.use("/api", (req, res, next) => {
    if (
      req.path.startsWith("/auth/") ||
      req.path === "/health" ||
      req.path === "/health/"
    ) {
      return next();
    }
    authenticateToken(req, res, next);
  });

  app.get("/api/chat/history", authenticateToken, (req: any, res) => {
    const user = req.user.email;
    const userPrivates = privateMessages.filter((m: any) => m.user === user || m.recipient === user);
    res.json({
      global: globalMessages,
      private: userPrivates
    });
  });

  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const users = await readUsers();
      res.json(users.map((u: any) => ({ email: u.email })));
    } catch (err) {
      res.status(500).json({ error: "Failed to read users" });
    }
  });

  // AUTH ROUTES
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
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

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
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

  app.get("/api/matches/history", async (req, res) => {
    try {
      res.json(await readMatchHistory());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to read match history" });
    }
  });

  app.post("/api/matches/history", async (req, res) => {
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

  // API ROUTE: Get all experts
  app.get("/api/experts", async (req, res) => {
    try {
      const experts = await readExperts();
      res.json(experts);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to read experts" });
    }
  });

  // API ROUTE: Add a new expert manually
  app.post("/api/experts", async (req, res) => {
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

  // API ROUTE: Delete an expert
  app.delete("/api/experts/:id", async (req, res) => {
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

  // API ROUTE: Sync multiple experts (overwrite or merge)
  app.post("/api/experts/sync", async (req, res) => {
    try {
      // For simplicity, we will just completely overwrite with the uploaded parsed data
      // Or we can merge. Let's overwrite / append if we want.
      // E.g., user is syncing a full sheet. Let's do a complete overwrite for clear sync logic.
      const newExperts = req.body.experts;
      if (!Array.isArray(newExperts)) {
        return res
          .status(400)
          .json({ error: "Missing or invalid experts array" });
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

  // API ROUTE: Get all sources
  app.get("/api/sources", async (req, res) => {
    try {
      res.json(await readSources());
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to read sources" });
    }
  });

  // API ROUTE: Add a source
  app.post("/api/sources", async (req, res) => {
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

      // Attempt to immediately trigger a sync for it
      // Let the frontend orchestrate it using /api/sources/sync
      res.json(newSource);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to add source" });
    }
  });

  // API ROUTE: Delete a source
  app.delete("/api/sources/:id", async (req, res) => {
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

  // API ROUTE: Sync a specific source or all sources
  app.post("/api/sources/sync", async (req, res) => {
    try {
      const { sourceId } = req.body;
      const sources = await readSources();

      const sourcesToSync = sourceId
        ? sources.filter((s: any) => s.id === sourceId)
        : sources;

      if (sourcesToSync.length === 0) {
        return res.status(404).json({ error: "No sources to sync found" });
      }

      let allExperts: any[] = [];

      for (const source of sourcesToSync) {
        const link = source.url;
        const match = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          const sheetId = match[1];
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

          try {
            const response = await axios.get(exportUrl, {
              responseType: "text",
            });
            const csvData = response.data;

            const parsed = Papa.parse(csvData, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim().toLowerCase(),
            });
            const knownKeys = [
              "id",
              "name",
              "fullname",
              "full name",
              "expert",
              "role",
              "title",
              "job",
              "job title",
              "current job title / role",
              "current professional headline",
              "current / most recent role",
              "industry",
              "primary industry",
              "key sectors / industries",
              "sectors",
              "experience",
              "exp",
              "level",
              "years",
              "total years of experience",
              "total years of professional experience",
              "email",
              "personal email",
              "contact",
              "notes",
              "description",
              "bio",
              "brief professional bio",
              "please provide a brief biography / professional summary",
              "first name",
              "last name",
            ];
            const pExperts = parsed.data
              .map((row: any) => {
                const industry =
                  row.industry ||
                  row["primary industry"] ||
                  row["key sectors / industries"] ||
                  row.sectors ||
                  "";

                const metadata: Record<string, any> = {};
                for (const key of Object.keys(row)) {
                  if (
                    key &&
                    !knownKeys.includes(key.toLowerCase()) &&
                    row[key] !== ""
                  ) {
                    metadata[key] = row[key];
                  }
                }

                let name =
                  row.name ||
                  row.fullname ||
                  row["full name"] ||
                  row.expert ||
                  "";
                if (!name && row["first name"]) {
                  name =
                    `${row["first name"]} ${row["last name"] || ""}`.trim();
                }
                if (!name) name = "Unknown";

                const role =
                  row.role ||
                  row.title ||
                  row.job ||
                  row["job title"] ||
                  row["current job title / role"] ||
                  row["current professional headline"] ||
                  row["current / most recent role"] ||
                  "";
                const experience =
                  row.experience ||
                  row.exp ||
                  row.level ||
                  row.years ||
                  row["total years of experience"] ||
                  row["total years of professional experience"] ||
                  "";
                const email =
                  row.email || row["personal email"] || row.contact || "";
                const notes =
                  row.notes ||
                  row.description ||
                  row.bio ||
                  row["brief professional bio"] ||
                  row[
                    "please provide a brief biography / professional summary"
                  ] ||
                  "";

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

            allExperts = [...allExperts, ...pExperts];
            source.lastSynced = new Date().toISOString();
          } catch (err: any) {
            console.error(`Failed to fetch sheet ${link}:`, err.message);
          }
        }
      }

      const existingExperts = await readExperts();
      const updatedExperts = [...existingExperts];

      for (const ne of allExperts) {
        if (ne.email) {
          const idx = updatedExperts.findIndex((e) => e.email === ne.email);
          if (idx !== -1) {
            updatedExperts[idx] = {
              ...updatedExperts[idx],
              ...ne,
              metadata: { ...updatedExperts[idx].metadata, ...ne.metadata },
            };
          } else {
            updatedExperts.push(ne);
          }
        } else {
          const idx = updatedExperts.findIndex((e) => e.name === ne.name);
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
      }

      await writeExperts(updatedExperts);
      await writeSources(sources);

      res.json({ success: true, count: allExperts.length });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to sync sources" });
    }
  });

  // API ROUTE: Health check
  app.get(["/api/health", "/api/health/"], (req, res) => {
    res.json({ status: "ok" });
  });

  // API ROUTE: Proxy CV
  app.get(["/api/proxy-cv", "/api/proxy-cv/"], async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing url" });

    try {
      let targetUrl = url;
      // Auto-convert Google Drive links to text export if it's a Document
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
      const text = response.data.substring(0, 5000); // Limit to 5000 chars

      res.setHeader("Content-Type", "text/plain");
      res.send(text);
    } catch (err: any) {
      console.error("CV Fetch Error:", err.message);
      res.status(500).json({ error: "Failed to fetch CV text" });
    }
  });

  // API ROUTE: Match query using GenAI
  app.post("/api/match", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Missing query parameter" });
      }

      const experts = await readExperts();

      // Try to load Gemini model
      const { GoogleGenAI } = await import("@google/genai");

      if (!process.env.GEMINI_API_KEY) {
        // Fallback if no API key is provided
        throw new Error("GEMINI_API_KEY is not set.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // We will only send essential data to Gemini to avoid exceeding context
      const simplifiedExperts = experts.map((e: any) => ({
        id: e.id,
        role: e.role,
        industry: e.industry,
        experience: e.experience,
        notes: e.notes ? e.notes.substring(0, 500) : "",
        metadata: e.metadata ? e.metadata : undefined, 
      }));

      const prompt = `You are a matching engine for finding the best professional experts based on a user's typed requirement.
You have a directory of experts (provided as JSON). Look at the user's requirement and determine the top 5 best matching experts from the provided list.
For each match, provide a match percentage (0 to 100), a reason why they are a good fit, and any gaps (missing skills, experience etc.) between their profile and the requirement.

User Requirement: "${query}"

Experts Data:
${JSON.stringify(simplifiedExperts, null, 2)}

Return a raw JSON array of objects with strictly the following format:
[
  {
    "id": "expert_id_here",
    "matchPercentage": 95,
    "matchReason": "why they fit",
    "gaps": "any missing skills or experience"
  }
]
Return ONLY the raw JSON array. DO NOT wrap with markdown blocks like \`\`\`json.`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const responseText = aiResponse.text || "[]";
      // Handle potential markdown formatting from AI
      const cleanText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsedMatches = [];
      try {
        parsedMatches = JSON.parse(cleanText);
      } catch (parseErr) {
        console.error("AI returned malformed JSON:", cleanText);
        // Fallback dummy
        parsedMatches = [];
      }

      // Populate full details for matches
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
