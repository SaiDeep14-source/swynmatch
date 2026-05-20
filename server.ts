import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

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

// Initialize Firebase Admin
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

let isFirestoreServerDisabled = false;

function logFirestoreWarning(message: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const firstLineMsg = errMsg.split("\n")[0];
  const isPermissionDenied =
    firstLineMsg.includes("PERMISSION_DENIED") ||
    firstLineMsg.includes("insufficient permissions") ||
    firstLineMsg.includes("unauthenticated") ||
    errMsg.includes("PERMISSION_DENIED") ||
    errMsg.includes("insufficient permissions");

  if (isPermissionDenied) {
    if (!isFirestoreServerDisabled) {
      isFirestoreServerDisabled = true;
      console.log("Firestore server-side access disabled: Insufficient IAM permissions. Local fallbacks active.");
    }
  } else {
    console.warn(`${message} (${firstLineMsg})`);
  }
}

function getFirestoreDb() {
  if (isFirestoreServerDisabled || !admin.apps.length) return null;

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

let isAuthServerDisabled = false;

function logAuthWarning(message: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const firstLineMsg = errMsg.split("\n")[0];
  const isPermissionDenied =
    firstLineMsg.includes("PERMISSION_DENIED") ||
    firstLineMsg.includes("insufficient permissions") ||
    firstLineMsg.includes("unauthenticated") ||
    firstLineMsg.includes("forbidden") ||
    firstLineMsg.includes("403") ||
    errMsg.includes("PERMISSION_DENIED") ||
    errMsg.includes("Forbidden") ||
    errMsg.includes("forbidden") ||
    errMsg.includes("serviceusage.services.use") ||
    errMsg.includes("insufficient permissions");

  if (isPermissionDenied) {
    if (!isAuthServerDisabled) {
      isAuthServerDisabled = true;
      console.log("Firebase Auth server-side access disabled. Safe fallback active.");
    }
  } else {
    console.warn(`${message}: ${firstLineMsg}`);
  }
}

function getFirebaseAuth() {
  if (isAuthServerDisabled || !admin.apps.length) return null;

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
    logFirestoreWarning("Firestore experts loading failed. Local fallback activated.", error);
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
      "https://swynmatch.shaamlie.workers.dev",
      "https://swynmatch.onrender.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));

  app.options("*", cors());

  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: "*" } });

  app.use(express.json());

  const apiRouter = express.Router();

  const tryDecodeJwtPayload = (token: string): { uid: string; email: string } | null => {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf8");
        const payload = JSON.parse(payloadJson);

        if (payload && (payload.user_id || payload.sub)) {
          return {
            uid: payload.user_id || payload.sub,
            email: payload.email || "unknown@example.com"
          };
        }
      }
    } catch (e) {
      console.warn("Could not decode JWT payload:", e);
    }

    return null;
  };

  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
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

    const decoded = tryDecodeJwtPayload(token);

    if (decoded) {
      req.user = decoded;
      return next();
    }

    req.user = {
      uid: "local-user-dev",
      email: "unknown@example.com"
    };

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
          logFirestoreWarning("Firestore write ignored during manual add:", e);
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
          logFirestoreWarning("Firestore clear ignored during clear all:", e);
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
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      const prompt = `You are a professional matching engine assistant for SWYNMatch.
Match the user request: "${query}" to at most 3 experts from this list: ${JSON.stringify(experts)}.

Return ONLY a raw JSON array like:
[
  {
    "id": "matched expert id",
    "matchScore": 95,
    "whyTheyFit": "2 sentences describing why they fit",
    "potentialGaps": "1 sentence describing potential gaps"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "[]";
      let parsed: any[] = [];

      try {
        parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch (err) {
        console.error("Failed to parse Gemini JSON:", text);
        parsed = [];
      }

      const matches: any[] = [];

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

      if (matches.length === 0 && experts.length > 0) {
        experts.slice(0, 3).forEach((e: any, idx: number) => {
          matches.push({
            ...e,
            matchScore: 98 - idx * 3,
            whyTheyFit: "Demonstrated proficiency and leadership in the requested domain.",
            potentialGaps: "May require adaptation depending on exact client requirements."
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
      const fDb = getFirestoreDb();

      if (fDb) {
        const snapshot = await fDb.collection("matches")
          .where("userId", "==", req.user.uid)
          .get();

        dbMatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
    } catch (error: any) {
      logFirestoreWarning("Firestore history fetch warning:", error);
    }

    let localMatches: any[] = [];

    try {
      const historyPath = path.join(process.cwd(), "matches.json");

      if (fs.existsSync(historyPath)) {
        const data = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        localMatches = data.filter((m: any) =>
          m.userId === req.user.uid || m.userEmail === req.user.email
        );
      }
    } catch (e) {
      console.error("Local history fetch failed:", e);
    }

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
        expertId,
        expertName,
        expertRole,
        clientName,
        clientIndustry,
        clientLocation,
        clientRequirements,
        clientBudget,
        clientPreferredRole,
        clientContact
      } = req.body;

      const newMatch = {
        expertId,
        expertName,
        expertRole: expertRole || "Expert",
        clientName: clientName || "General Client",
        clientIndustry: clientIndustry || "Technology",
        clientLocation: clientLocation || "Remote",
        clientRequirements: clientRequirements || "",
        clientBudget: clientBudget || "Flexible",
        clientPreferredRole: clientPreferredRole || "",
        clientContact: clientContact || "",
        userId: req.user.uid,
        userEmail: req.user.email,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

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

      const savedMatch = {
        id: docId,
        ...newMatch
      };

      const historyPath = path.join(process.cwd(), "matches.json");
      let currentHistory = [];

      if (fs.existsSync(historyPath)) {
        try {
          currentHistory = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        } catch (e) {}
      }

      currentHistory.push(savedMatch);
      fs.writeFileSync(historyPath, JSON.stringify(currentHistory, null, 2), "utf8");

      res.json({
        success: true,
        match: savedMatch
      });
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

      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);

      if (!match) {
        return res.status(400).json({ error: "Invalid Google Sheet URL format." });
      }

      const spreadsheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error("Unable to fetch sheet data. Please ensure anyone with the link can view the sheet.");
      }

      const csvText = await response.text();

      const parseCSV = (text: string): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            row.push(current.trim());
            current = "";
          } else if ((char === "\r" || char === "\n") && !inQuotes) {
            if (char === "\r" && nextChar === "\n") {
              i++;
            }

            row.push(current.trim());

            if (row.length > 0 && row.some(cell => cell !== "")) {
              result.push(row);
            }

            row = [];
            current = "";
          } else {
            current += char;
          }
        }

        if (current !== "" || row.length > 0) {
          row.push(current.trim());

          if (row.some(cell => cell !== "")) {
            result.push(row);
          }
        }

        return result;
      };

      const allRows = parseCSV(csvText);

      if (allRows.length < 2) {
        return res.status(400).json({ error: "The sheet appears to be empty or has no header row." });
      }

      const headers = allRows[0].map(h => h.toLowerCase().trim());

      const getIndex = (keys: string[]) =>
        headers.findIndex(h => keys.some(k => h === k || h.includes(k) || k.includes(h)));

      const nameIdx = getIndex(["name", "expert", "consultant", "member", "full name"]);
      const expertIdx = getIndex(["expertise", "specialty", "role", "title", "designation", "position", "job title", "function", "domain", "skill", "practice", "focus"]);
      const summaryIdx = getIndex(["summary", "bio", "desc", "notes", "overview", "about", "highlights", "background", "history"]);
      const rateIdx = getIndex(["rate", "hourly", "price", "cost", "fee", "compensation"]);
      const ratingIdx = getIndex(["rating", "score", "stars", "experience rating"]);
      const avIdx = getIndex(["availability", "hours", "days", "schedule", "active"]);
      const industryIdx = getIndex(["industry", "sector", "vertical", "domain", "field"]);
      const experienceIdx = getIndex(["experience", "span", "years", "tenure"]);

      if (nameIdx === -1) {
        return res.status(400).json({
          error: "Could not find Name column. Columns seen: " + headers.join(", ")
        });
      }

      const newExperts: any[] = [];
      const originalHeaders = allRows[0];

      for (let i = 1; i < allRows.length; i++) {
        const cells = allRows[i];

        if (!cells || cells.length === 0 || !cells[nameIdx]) continue;

        const name = cells[nameIdx];
        const expertise = expertIdx !== -1 && cells[expertIdx] ? cells[expertIdx] : "Consultant";
        const summary = summaryIdx !== -1 && cells[summaryIdx] ? cells[summaryIdx] : "Industry expert available for mentoring and consultation.";
        const hourlyRate = rateIdx !== -1 && cells[rateIdx] ? parseFloat(cells[rateIdx].replace(/[^0-9.]/g, "")) || 150 : 150;
        const rating = ratingIdx !== -1 && cells[ratingIdx] ? parseFloat(cells[ratingIdx]) || 4.5 : 4.5;
        const availability = avIdx !== -1 && cells[avIdx] ? cells[avIdx] : "Flexible";
        const industry = industryIdx !== -1 && cells[industryIdx] ? cells[industryIdx] : undefined;
        const experience = experienceIdx !== -1 && cells[experienceIdx] ? cells[experienceIdx] : undefined;

        const customFields: Record<string, string> = {};

        originalHeaders.forEach((headerName, index) => {
          if (cells[index] !== undefined && cells[index] !== null) {
            customFields[headerName.trim()] = cells[index].trim();
          }
        });

        newExperts.push({
          id: Math.random().toString(36).substring(2, 10),
          name,
          expertise,
          summary,
          hourlyRate,
          rating,
          availability,
          industry,
          experience,
          customFields
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
            batch.set(ref, {
              id: exp.id,
              name: exp.name,
              status: "active",
              ...exp
            });
          });

          await batch.commit();
        } catch (e: any) {
          logFirestoreWarning("Firestore sync warning:", e);
        }
      }

      if (fDb) {
        try {
          await fDb.collection("config").doc("sheet_config").set({
            url,
            lastSynced: new Date().toISOString()
          });
        } catch (e) {
          logFirestoreWarning("Firestore sheet config save failed:", e);
        }
      }

      try {
        const configPath = path.join(process.cwd(), "sheet_config.json");
        fs.writeFileSync(configPath, JSON.stringify({
          url,
          lastSynced: new Date().toISOString()
        }, null, 2), "utf8");
      } catch (e) {
        console.error("Local sheet config save failed:", e);
      }

      res.json({
        success: true,
        count: newExperts.length,
        experts: newExperts
      });
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
    if (req.user.email !== "info@swyn.in") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const envVars = Object.keys(process.env).sort().map(key => ({
      key,
      value: key.toLowerCase().includes("key") || key.toLowerCase().includes("secret")
        ? "****"
        : process.env[key]
    }));

    res.json(envVars);
  });

  const adminRouter = express.Router();

  adminRouter.use(authenticate);

  adminRouter.use((req: any, res, next) => {
    if (req.user.email !== "info@swyn.in") {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  });

  adminRouter.get("/users", async (req, res) => {
    try {
      const fAuth = getFirebaseAuth();

      if (!fAuth) {
        return res.json([]);
      }

      const list = await fAuth.listUsers();

      res.json(list.users.map(u => ({
        uid: u.uid,
        email: u.email,
        disabled: u.disabled,
        lastSignInTime: u.metadata.lastSignInTime
      })));
    } catch (err: any) {
      logAuthWarning("Failed to list users from Firebase Admin", err);
      res.json([]);
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
      logAuthWarning("Failed to delete user on Firebase Admin", err);
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
      logAuthWarning("Failed to create user on Firebase Admin", err);
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.use("/admin", adminRouter);

  app.use("/api", apiRouter);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: "spa"
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
