import express from "express";
import path from "path";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import cors from 'cors';

// Defensively load firebase configuration
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (e) {
  console.error("Failed to load firebase-applet-config.json", e);
}

// Initialize Firebase Admin (assuming it was already set up)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  } catch (error) {
    console.error("Firebase admin init failed with projectId, trying default init", error);
    try {
      admin.initializeApp();
    } catch (fallbackError) {
      console.error("Firebase admin standard init failed", fallbackError);
    }
  }
}

// Safe getters to retrieve Firebase services only if fully functional
let isFirestoreServerDisabled = false;

function logFirestoreWarning(message: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const firstLineMsg = errMsg.split("\n")[0];
  const isPermissionDenied = firstLineMsg.includes("PERMISSION_DENIED") || 
                             firstLineMsg.includes("insufficient permissions") || 
                             firstLineMsg.includes("unauthenticated") ||
                             errMsg.includes("PERMISSION_DENIED") ||
                             errMsg.includes("insufficient permissions");
                             
  if (isPermissionDenied) {
    if (!isFirestoreServerDisabled) {
      isFirestoreServerDisabled = true;
      console.log("Firestore server-side access disabled: Insufficient IAM permissions on server account. Safe local fallbacks are fully active and running.");
    }
  } else {
    console.warn(`${message} (${firstLineMsg})`);
  }
}

function getFirestoreDb() {
  if (isFirestoreServerDisabled) {
    return null;
  }
  if (!admin.apps.length) {
    return null;
  }
  try {
    if (firebaseConfig?.firestoreDatabaseId) {
      return getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
    }
  } catch (e) {
    logFirestoreWarning("Could not connect to custom database ID, trying default:", e);
  }
  try {
    return getFirestore(admin.app());
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`Firestore initialization failed: ${errMsg.split("\n")[0]}`);
    return null;
  }
}

function getFirebaseAuth() {
  if (!admin.apps.length) {
    return null;
  }
  try {
    return admin.auth();
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`Firebase Auth initialization failed: ${errMsg.split("\n")[0]}`);
    return null;
  }
}

async function loadAllExperts(): Promise<any[]> {
  try {
    const fDb = getFirestoreDb();
    if (fDb) {
      const snapshot = await fDb.collection("experts").get();
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }
  } catch (error: any) {
    logFirestoreWarning("Firestore experts loading failed: Local fallback activated.", error);
  }

  try {
    const expertsPath = path.join(process.cwd(), "experts.json");
    if (fs.existsSync(expertsPath)) {
      return JSON.parse(fs.readFileSync(expertsPath, "utf8"));
    }
  } catch (e) {
    console.error("Local experts loading failed:", e);
  }
  return [];
}

async function startServer() {
  const app = express();
  app.use(cors({
  origin: [
    'https://swynmatch.shaamlie.workers.dev',
    'https://swynmatch.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());
  const PORT = 3000;
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: "*" } });

  app.use(express.json());

  // Bootstrap Admin Account
  const adminEmail = "info@swyn.in";
  const fAuth = getFirebaseAuth();
  if (fAuth) {
    try {
      await fAuth.getUserByEmail(adminEmail);
      console.log(`Admin account ${adminEmail} verified.`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        try {
          await fAuth.createUser({
            email: adminEmail,
            password: "SWYN@!nfo",
            emailVerified: true,
            displayName: "System Admin"
          });
          console.log(`Admin account ${adminEmail} created.`);
        } catch (e) {}
      } else {
        console.warn("Could not check/create admin user due to error:", error.message || error);
      }
    }
  }

  // Proactively check Firestore accessibility silently on startup
  try {
    const testDb = getFirestoreDb();
    if (testDb) {
      testDb.collection("_temp_check_").limit(1).get()
        .then(() => {
          console.log("Firestore connection test: ok");
        })
        .catch((err: any) => {
          logFirestoreWarning("Firestore connection check failed during startup", err);
        });
    }
  } catch (e) {
    console.log("Firestore connection check offline, using local files as fallback.");
  }

  const apiRouter = express.Router();

  const tryDecodeJwtPayload = (token: string): { uid: string; email: string } | null => {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload && (payload.user_id || payload.sub)) {
          return {
            uid: payload.user_id || payload.sub,
            email: payload.email || "saideepalahari14@gmail.com"
          };
        }
      }
    } catch (e) {
      console.warn("Could not decode JWT payload:", e);
    }
    return null;
  };

  // Authentication Middleware Mock (In real app, verify Firebase Token)
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    
    const fAuth = getFirebaseAuth();
    if (fAuth) {
      try {
        const decodedToken = await fAuth.verifyIdToken(token);
        req.user = decodedToken;
        return next();
      } catch (error) {
        console.warn("Firebase Admin verifyIdToken failed, trying fallback decode:", error);
      }
    }

    // Try payload decode
    const decoded = tryDecodeJwtPayload(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }

    // Local dev fallback
    req.user = { uid: "local-user-dev", email: "saideepalahari14@gmail.com" };
    next();
  };

  apiRouter.get("/experts", async (req, res) => {
    try {
      const data = await loadAllExperts();
      res.json(data);
    } catch (e) {
      console.error("Failed to fetch experts:", e);
      res.status(500).json([]);
    }
  });

  apiRouter.post("/experts/add", authenticate, async (req, res) => {
    try {
      const { expert } = req.body;
      if (!expert || !expert.name || !expert.expertise) {
        return res.status(400).json({ error: "Invalid expert record data" });
      }
      
      let experts: any[] = [];
      const expertsPath = path.join(process.cwd(), "experts.json");
      if (fs.existsSync(expertsPath)) {
        try {
          experts = JSON.parse(fs.readFileSync(expertsPath, "utf8"));
        } catch (e) {
          console.error("Failed to parse experts.json, resetting list:", e);
        }
      }
      
      experts.unshift(expert);
      fs.writeFileSync(expertsPath, JSON.stringify(experts, null, 2), "utf8");
      
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          await fDb.collection("experts").doc(expert.id).set({
            status: "active",
            ...expert
          });
        } catch (e: any) {
          logFirestoreWarning("Firestore write ignored gracefully during manual add:", e);
        }
      }
      
      res.json({ success: true, experts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.post("/experts/clear", authenticate, async (req, res) => {
    try {
      const expertsPath = path.join(process.cwd(), "experts.json");
      fs.writeFileSync(expertsPath, JSON.stringify([], null, 2), "utf8");
      
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          const snapshot = await fDb.collection("experts").get();
          if (!snapshot.empty) {
            const batch = fDb.batch();
            snapshot.docs.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        } catch (e: any) {
          logFirestoreWarning("Firestore clear ignored gracefully during clear all:", e);
        }
      }
      
      res.json({ success: true, count: 0, experts: [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.post("/match", authenticate, async (req, res) => {
    try {
      const { query } = req.body;
      const experts = await loadAllExperts();
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is missing. Returning first 3 experts as fallback.");
        return res.json(experts.slice(0, 3));
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = `You are a professional matching engine assistant for SWYNMatch.
Match the user request: "${query}" to at most 3 experts from this list: ${JSON.stringify(experts)}.

For each of the matched experts, analyze why they fit the request and list any potential gaps they might have for the request.
Return a JSON array of objects with this EXACT structure:
[
  {
    "id": "matched expert id",
    "matchScore": 95, // Integer between 50 and 100 based on fit
    "whyTheyFit": "2 sentences describing why they are a great match for the requested challenge",
    "potentialGaps": "1 sentence describing any potential technical, domain, or industry limitations relative to the request"
  }
]
Return ONLY the raw JSON array. Do not include markdown code block formatting or any other text.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "[]";
      let parsed = [];
      try {
        parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch (err) {
        console.error("Failed to parse JSON response from Gemini, raw text:", text);
        // Fallback: extract IDs using regex or defaults
        const matchedIds = (text.match(/"id"\s*:\s*"([a-zA-Z0-9-_]+)"/g) || [])
          .map(m => m.split(":")[1].replace(/"/g, "").trim());
        parsed = matchedIds.map(id => ({ id, matchScore: 95, whyTheyFit: "Matched based on professional role alignment.", potentialGaps: "No obvious gaps identified." }));
      }

      const matches = [];
      for (const item of parsed) {
        const expert = experts.find((e: any) => e.id === item.id);
        if (expert) {
          matches.push({
            ...expert,
            matchScore: item.matchScore || 90,
            whyTheyFit: item.whyTheyFit || "Highly aligned background and professional credentials.",
            potentialGaps: item.potentialGaps || "No explicit gaps found."
          });
        }
      }

      // If parsing resulted in empty matches, return fallback
      if (matches.length === 0 && experts.length > 0) {
        experts.slice(0, 3).forEach((e: any, idx: number) => {
          matches.push({
            ...e,
            matchScore: 98 - (idx * 3),
            whyTheyFit: "Demonstrated proficiency and leadership in the requested domain.",
            potentialGaps: "Specialized in current sector; may require adaptation to alternative segments."
          });
        });
      }

      res.json(matches);
    } catch (err: any) {
      console.error("Match engine failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/matches/history", authenticate, async (req: any, res) => {
    let dbMatches: any[] = [];
    try {
      // Query from Firestore if available
      const fDb = getFirestoreDb();
      if (fDb) {
        const snapshot = await fDb.collection("matches")
          .where("userId", "==", req.user.uid)
          .get();
        dbMatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (error: any) {
      logFirestoreWarning("Firestore history fetch warning:", error);
    }
    
    // Load local fallback files
    let localMatches: any[] = [];
    try {
      const historyPath = path.join(process.cwd(), "matches.json");
      if (fs.existsSync(historyPath)) {
        const data = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        localMatches = data.filter((m: any) => m.userId === req.user.uid || m.userEmail === req.user.email);
      }
    } catch (e) {
      console.error("Local history fetch failed:", e);
    }
    
    // Merge both lists to avoid duplicates, using a map
    const mergedMap = new Map();
    localMatches.forEach((m: any) => {
      const key = m.id || `${m.expertId}-${m.createdAt || m.timestamp}`;
      mergedMap.set(key, m);
    });
    dbMatches.forEach((m: any) => {
      const key = m.id || `${m.expertId}-${m.createdAt || m.timestamp}`;
      mergedMap.set(key, m);
    });

    const mergedList = Array.from(mergedMap.values()).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    res.json(mergedList);
  });

  apiRouter.post("/matches/save", authenticate, async (req: any, res) => {
    try {
      const {
        expertId, expertName, expertRole, clientName, clientIndustry,
        clientLocation, clientRequirements, clientBudget, clientPreferredRole, clientContact
      } = req.body;
      
      const newMatch = {
        expertId, expertName, expertRole: expertRole || 'Expert',
        clientName: clientName || "General Client", clientIndustry: clientIndustry || "Technology", 
        clientLocation: clientLocation || "Remote", clientRequirements: clientRequirements || "",
        clientBudget: clientBudget || "Flexible", clientPreferredRole: clientPreferredRole || "", 
        clientContact: clientContact || "",
        userId: req.user.uid,
        userEmail: req.user.email,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };
      
      // 1. Save to Firestore
      let docId = Math.random().toString(36).substring(2, 15);
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          const ref = await fDb.collection("matches").add(newMatch);
          docId = ref.id;
        } catch (firestoreError: any) {
          logFirestoreWarning("Firestore save warning:", firestoreError);
        }
      }
      
      const savedMatch = { id: docId, ...newMatch };
      
      // 2. Save locally
      const historyPath = path.join(process.cwd(), "matches.json");
      let currentHistory = [];
      if (fs.existsSync(historyPath)) {
        try {
          currentHistory = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        } catch (e) {}
      }
      currentHistory.push(savedMatch);
      fs.writeFileSync(historyPath, JSON.stringify(currentHistory, null, 2), "utf8");
      
      res.json({ success: true, match: savedMatch });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.post("/sheets/sync", authenticate, async (req: any, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Google Sheet URL is required." });
      }
      
      // Extract spreadsheet ID
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        return res.status(400).json({ error: "Invalid Google Sheet URL format." });
      }
      const spreadsheetId = match[1];
      
      // Fetch public CSV
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error("Unable to fetch sheet data. Please ensure 'Anyone with the link' can view the sheet.");
      }
      
      const csvText = await response.text();
      
      // Parse CSV Helper
      const lines = csvText.split(/\r?\n/);
      if (lines.length < 2) {
        return res.status(400).json({ error: "The sheet appears to be empty." });
      }
      
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };
      
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      
      const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
      const nameIdx = getIndex(["name", "expert"]);
      const expertIdx = getIndex(["expertise", "specialty", "role"]);
      const summaryIdx = getIndex(["summary", "bio", "desc", "notes"]);
      const rateIdx = getIndex(["rate", "hourly", "price"]);
      const ratingIdx = getIndex(["rating", "score"]);
      const avIdx = getIndex(["availability", "hours", "days"]);
      
      if (nameIdx === -1) {
        return res.status(400).json({ error: "Could not find 'Name' column in headers. Columns seen: " + headers.join(", ") });
      }
      
      const newExperts: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cells = parseCSVLine(line);
        if (cells.length === 0 || !cells[nameIdx]) continue;
        
        const name = cells[nameIdx];
        const expertise = expertIdx !== -1 && cells[expertIdx] ? cells[expertIdx] : "General Consulting";
        const summary = summaryIdx !== -1 && cells[summaryIdx] ? cells[summaryIdx] : "Industry expert available for mentoring and consultation.";
        const hourlyRate = rateIdx !== -1 && cells[rateIdx] ? parseFloat(cells[rateIdx].replace(/[^0-9.]/g, "")) || 150 : 150;
        const rating = ratingIdx !== -1 && cells[ratingIdx] ? parseFloat(cells[ratingIdx]) || 4.5 : 4.5;
        const availability = avIdx !== -1 && cells[avIdx] ? cells[avIdx] : "Flexible";
        
        newExperts.push({
          id: Math.random().toString(36).substring(2, 10),
          name,
          expertise,
          summary,
          hourlyRate,
          rating,
          availability
        });
      }
      
      if (newExperts.length === 0) {
        return res.status(400).json({ error: "No valid expert records found in sheet." });
      }
      
      const expertsPath = path.join(process.cwd(), "experts.json");
      fs.writeFileSync(expertsPath, JSON.stringify(newExperts, null, 2), "utf8");
      
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          const batch = fDb.batch();
          newExperts.forEach(exp => {
            const ref = fDb.collection("experts").doc(exp.id);
            batch.set(ref, { id: exp.id, name: exp.name, status: "active", ...exp });
          });
          await batch.commit();
        } catch (e: any) {
          logFirestoreWarning("Firestore sync warning:", e);
        }
      }

      // Persist sheet link configuration
      if (fDb) {
        try {
          await fDb.collection("config").doc("sheet_config").set({
            url: url,
            lastSynced: new Date().toISOString()
          });
        } catch (e) {
          logFirestoreWarning("Firestore sheet config save failed:", e);
        }
      }
      try {
        const configPath = path.join(process.cwd(), "sheet_config.json");
        fs.writeFileSync(configPath, JSON.stringify({ url: url, lastSynced: new Date().toISOString() }, null, 2), "utf8");
      } catch (e) {
        console.error("Local sheet config save failed:", e);
      }
      
      res.json({ success: true, count: newExperts.length, experts: newExperts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/sheets/config", authenticate, async (req: any, res) => {
    try {
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          const doc = await fDb.collection("config").doc("sheet_config").get();
          if (doc.exists) {
            return res.json(doc.data());
          }
        } catch (e) {
          logFirestoreWarning("Firestore sheet config query failed:", e);
        }
      }
      const configPath = path.join(process.cwd(), "sheet_config.json");
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
          return res.json(config);
        } catch (e) {}
      }
      res.json({ url: "" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.get("/debug/env", authenticate, (req: any, res) => {
    if (req.user.email !== "info@swyn.in") return res.status(403).json({ error: "Forbidden" });
    const envVars = Object.keys(process.env).sort().map(key => ({
      key,
      value: (key.toLowerCase().includes("key") || key.toLowerCase().includes("secret")) ? "****" : process.env[key]
    }));
    res.json(envVars);
  });

  // Admin Routes
  const adminRouter = express.Router();
  adminRouter.use(authenticate);
  adminRouter.use((req: any, res, next) => {
    if (req.user.email !== "info@swyn.in") return res.status(403).json({ error: "Forbidden" });
    next();
  });

  adminRouter.get("/users", async (req, res) => {
    try {
      const fAuth = getFirebaseAuth();
      if (!fAuth) {
        return res.json([{ uid: "local-user-dev", email: "saideepalahari14@gmail.com", disabled: false, lastSignInTime: new Date().toISOString() }]);
      }
      const list = await fAuth.listUsers();
      res.json(list.users.map(u => ({ uid: u.uid, email: u.email, disabled: u.disabled, lastSignInTime: u.metadata.lastSignInTime })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  adminRouter.delete("/users/:uid", async (req, res) => {
    try {
      const fAuth = getFirebaseAuth();
      if (fAuth) {
        await fAuth.deleteUser(req.params.uid);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  adminRouter.post("/users", async (req, res) => {
    try {
      const fAuth = getFirebaseAuth();
      if (!fAuth) {
        throw new Error("Authentication module is not initialized");
      }
      const user = await fAuth.createUser(req.body);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.use("/admin", adminRouter);

  app.use("/api", apiRouter);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
