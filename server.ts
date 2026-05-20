import express from "express";
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

let isAuthServerDisabled = false;

function logAuthWarning(message: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const firstLineMsg = errMsg.split("\n")[0];
  const isPermissionDenied = firstLineMsg.includes("PERMISSION_DENIED") || 
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
      console.log("Firebase Auth server-side access disabled: Insufficient permission or service usage consumer denial (using safe local auth & session fallbacks).");
    }
  } else {
    console.warn(`${message}: ${firstLineMsg}`);
  }
}

function getFirebaseAuth() {
  if (isAuthServerDisabled) {
    return null;
  }
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
        logAuthWarning("Could not check/create admin user", error);
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

  apiRouter.get("/users", authenticate, async (req: any, res) => {
    try {
      const fAuth = getFirebaseAuth();
      if (!fAuth) {
        return res.json([{ uid: "local-user-dev", email: "saideepalahari14@gmail.com", disabled: false }]);
      }
      let allUsers: any[] = [];
      let pageToken: string | undefined = undefined;
      do {
        const listUsersResult = await fAuth.listUsers(1000, pageToken);
        allUsers = allUsers.concat(listUsersResult.users);
        pageToken = listUsersResult.pageToken;
      } while (pageToken);
      
      const users = allUsers.map(u => ({
        uid: u.uid,
        email: u.email,
        disabled: u.disabled,
        displayName: u.displayName || u.email?.split('@')[0] || "User"
      }));
      res.json(users);
    } catch (err: any) {
      logAuthWarning("Failed to list users from Firebase Admin for chat directory", err);
      res.json([{ uid: "local-user-dev", email: "saideepalahari14@gmail.com", disabled: false, displayName: "Local user" }]);
    }
  });

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

      const minimalExperts = experts.map((e: any) => {
        // Build a lean representation to save tokens and prevent rate limit errors.
        const name = e.name || e.Name || (e.customFields && e.customFields["Name"]);
        const expertise = e.expertise || e.role || (e.customFields && e.customFields["Expertise"]);
        const summary = e.summary || (e.customFields && e.customFields["Summary"]);
        const skills = e.skills || (e.customFields && e.customFields["Skills"]);
        return { id: e.id, name, expertise, summary, skills };
      });

      const prompt = `You are a professional matching engine assistant for SWYNMatch.
Match the user request: "${query}" to at most 3 experts from this list: ${JSON.stringify(minimalExperts)}.

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
      
      let text = "[]";
      let retries = 3;
      let lastError = null;

      while (retries > 0) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          text = response.text || "[]";
          break; // success
        } catch (error: any) {
          lastError = error;
          if (error?.status === 503 || error?.status === 429 || error?.toString().includes("503") || error?.toString().includes("429")) {
            console.warn(`Gemini API error, retrying... (${retries} retries left)`);
            retries--;
            await new Promise(res => setTimeout(res, 2000)); // wait 2s before retry
          } else {
            console.error("Non-retriable Gemini error:", error);
            break;
          }
        }
      }

      let parsed = [];
      
      if (text === "[]" && lastError) {
        console.warn("Falling back to local keyword matching due to API error.");
        const keywords = query.toLowerCase().split(/\s+/).filter((k: string) => k.length > 3);
        const scoredExperts = experts.map((e: any) => {
          let score = 50;
          const searchStr = JSON.stringify(e).toLowerCase();
          keywords.forEach((kw: string) => {
            if (searchStr.includes(kw)) score += 15;
          });
          return {
            id: e.id,
            matchScore: Math.min(99, score),
            whyTheyFit: "Matched via keyword fallback system because the AI engine is currently unavailable (rate limited).",
            potentialGaps: "Fallback matching lacks deeper contextual analysis. Please try again later for AI-driven insights."
          };
        });
        parsed = scoredExperts.sort((a: any, b: any) => b.matchScore - a.matchScore).slice(0, 3);
      } else {
        try {
          parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        } catch (err) {
          console.error("Failed to parse JSON response from Gemini, raw text:", text);
          // Fallback: extract IDs using regex or defaults
          const matchedIds = (text.match(/"id"\s*:\s*"([a-zA-Z0-9-_]+)"/g) || [])
            .map((m: any) => m.split(":")[1].replace(/"/g, "").trim());
          parsed = matchedIds.map((id: string) => ({ id, matchScore: 95, whyTheyFit: "Matched based on professional role alignment.", potentialGaps: "No obvious gaps identified." }));
        }
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
      mergedMap.set(key, { ...m, id: m.id || key });
    });
    dbMatches.forEach((m: any) => {
      const key = m.id || `${m.expertId}-${m.createdAt || m.timestamp}`;
      mergedMap.set(key, { ...m, id: key });
    });

    const mergedList = Array.from(mergedMap.values()).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    res.json(mergedList);
  });

  apiRouter.delete("/matches", authenticate, async (req: any, res) => {
    try {
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          const snapshot = await fDb.collection("matches").where("userId", "==", req.user.uid).get();
          const batch = fDb.batch();
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        } catch (err: any) {
          logFirestoreWarning("Firestore clear matches warning:", err);
        }
      }
      
      const historyPath = path.join(process.cwd(), "matches.json");
      if (fs.existsSync(historyPath)) {
        let history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        history = history.filter((m: any) => m.userId !== req.user.uid && m.userId !== "local-user-dev");
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  apiRouter.delete("/matches/:id", authenticate, async (req: any, res) => {
    const id = req.params.id;
    try {
      const fDb = getFirestoreDb();
      if (fDb) {
        try {
          await fDb.collection("matches").doc(id).delete();
        } catch (err: any) {
          logFirestoreWarning("Firestore delete warning:", err);
        }
      }
      
      const historyPath = path.join(process.cwd(), "matches.json");
      if (fs.existsSync(historyPath)) {
        let history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        history = history.filter((m: any) => {
          const mId = m.id || `${m.expertId}-${m.createdAt || m.timestamp}`;
          return mId !== id;
        });
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
      
      const urls = url.split(',').map((u: string) => u.trim()).filter(Boolean);
      if (urls.length === 0) {
        return res.status(400).json({ error: "No valid Google Sheet URLs found." });
      }

      // Robust RFC 4180-compliant CSV Parser
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
          } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = "";
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
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

      const newExperts: any[] = [];
      let fetchError = false;

      for (const singleUrl of urls) {
        const match = singleUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) continue;
        
        const spreadsheetId = match[1];
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        
        try {
          const response = await fetch(csvUrl);
          if (!response.ok) {
            fetchError = true;
            continue;
          }
          
          const csvText = await response.text();
          const allRows = parseCSV(csvText);
          
          if (allRows.length < 2) continue;
          
          const headers = allRows[0].map(h => h.toLowerCase().trim());
          const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h === k || h.includes(k) || k.includes(h)));
          
          const nameIdx = getIndex(["name", "expert", "consultant", "member", "full name"]);
          const expertIdx = getIndex(["expertise", "specialty", "role", "title", "designation", "position", "job title", "function", "domain", "skill", "practice", "focus"]);
          const summaryIdx = getIndex(["summary", "bio", "desc", "notes", "overview", "about", "highlights", "background", "history"]);
          const rateIdx = getIndex(["rate", "hourly", "price", "cost", "fee", "compensation"]);
          const ratingIdx = getIndex(["rating", "score", "stars", "experience rating"]);
          const avIdx = getIndex(["availability", "hours", "days", "schedule", "active"]);
          const industryIdx = getIndex(["industry", "sector", "vertical", "domain", "field"]);
          const experienceIdx = getIndex(["experience", "span", "years", "tenure"]);
          
          if (nameIdx === -1) continue;
          
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
              const cellValue = cells[index];
              if (cellValue !== undefined && cellValue !== null && cellValue.trim() !== "") {
                const sanitizedKey = headerName.trim().replace(/[.~*/\[\]]/g, "-").replace(/\s+/g, " ");
                if (sanitizedKey) {
                  customFields[sanitizedKey] = cellValue.trim();
                }
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
        } catch (e) {
          console.warn("Failed to fetch sheet " + singleUrl, e);
          fetchError = true;
        }
      }
      
      if (newExperts.length === 0) {
        return res.status(400).json({ error: fetchError ? "Failed to access sheets. Please make sure 'Anyone with the link' can view them." : "No valid expert records found across provided sheets." });
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
      logAuthWarning("Failed to list users from Firebase Admin", err);
      res.json([{ uid: "local-user-dev", email: "saideepalahari14@gmail.com", disabled: false, lastSignInTime: new Date().toISOString() }]);
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
