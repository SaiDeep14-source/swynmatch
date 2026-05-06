import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Expert } from '../types';

// Use proxy endpoint instead of exposing API key directly on client
const generateContent = async (reqBody: any) => {
  const res = await fetch("/api/gemini/generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody)
  });
  if (!res.ok) throw new Error("AI Request failed");
  return await res.json();
};

interface MatchAnalysis {
  expertiseNeeded: string;
  industry: string;
  stage: string;
  problemStatement: string[];
  seniority: string;
  essentialSkills: string[];
  keywords: string[];
}

interface MatchResponse {
  analysis: MatchAnalysis;
  matches: Expert[];
  selectedExpertId?: string | null;
}

interface MatchingContextType {
  input: string;
  setInput: (val: string) => void;
  loading: boolean;
  result: MatchResponse | null;
  error: string;
  setError: (val: string) => void;
  handleMatch: (reqString?: string) => Promise<void>;
  selectExpert: (expertId: string) => Promise<void>;
  currentMatchId: string | null;
  resetMatching: () => void;
  restoreSession: (entry: any) => void;
}

const MatchingContext = createContext<MatchingContextType | undefined>(undefined);

export const MatchingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [input, setInput] = useState(() => sessionStorage.getItem('match_engine_input') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(() => {
    const saved = sessionStorage.getItem('match_engine_result');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState('');
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(() => sessionStorage.getItem('match_engine_id') || null);

  // Persist state
  useEffect(() => {
    sessionStorage.setItem('match_engine_input', input);
  }, [input]);

  useEffect(() => {
    if (result) {
      sessionStorage.setItem('match_engine_result', JSON.stringify(result));
    } else {
      sessionStorage.removeItem('match_engine_result');
    }
  }, [result]);

  useEffect(() => {
    if (currentMatchId) {
      sessionStorage.setItem('match_engine_id', currentMatchId);
    } else {
      sessionStorage.removeItem('match_engine_id');
    }
  }, [currentMatchId]);

  const resetMatching = useCallback(() => {
    setResult(null);
    setCurrentMatchId(null);
    setError('');
    sessionStorage.removeItem('match_engine_result');
    sessionStorage.removeItem('match_engine_id');
  }, []);

  const [experts, setExperts] = useState<Expert[]>([]);

  useEffect(() => {
    const expertsRef = collection(db, 'experts');
    const unsubscribe = onSnapshot(expertsRef, (snapshot) => {
      const expertData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expert[];
      setExperts(expertData);
    });

    return () => unsubscribe();
  }, []);

  const handleMatch = async (reqString?: string) => {
    const finalReq = reqString || input;
    if (!finalReq.trim()) return;
    setLoading(true);
    setError('');
    
    try {
      if (experts.length === 0) {
        throw new Error("Expert pool is empty. Please sync with Google Sheets first.");
      }

      // PHASE 1: Requirement Analysis
      const analysisPrompt = `
        You are an expert system and requirement analyzer.
        INPUT REQUIREMENTS: ${finalReq}
        Extract the core dimensions needed for matching.
        Return a JSON object with these keys: 
        expertiseNeeded (string), industry (string), stage (string), problemStatement (array), seniority (string), essentialSkills (array), keywords (array).
      `;

      const analysisResponse = await generateContent({
        model: "gemini-flash-latest",
        contents: analysisPrompt,
        config: { responseMimeType: "application/json" }
      });

      const analysisRaw = analysisResponse.text;
      if (!analysisRaw) throw new Error("Neural analysis failed");
      const analysis: MatchAnalysis = JSON.parse(analysisRaw);

      // PHASE 2: Candidate Ranking
      const candidatePool = experts.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        bio: e.bio,
        tags: e.tags,
        metadata: e.metadata,
        achievements: e.achievements,
        experience: e.experience
      }));

      const rankPrompt = `
        You are a world-class expert scout. Match the following requirements to the best experts in our pool.
        
        REQUIREMENTS:
        ${JSON.stringify(analysis, null, 2)}
        
        CANDIDATE POOL:
        ${JSON.stringify(candidatePool)}

        TASK: Identify the top 3 best experts. Even if no perfect match exists, find the closest semantic fits.
        Return a JSON array of exactly 3 objects:
        [{ "id": "expert_id", "score": number (0-100), "reason": "Specific paragraph explaining fits", "gap": "One sentence on what is missing" }]
      `;

      const rankResponse = await generateContent({
        model: "gemini-flash-latest",
        contents: rankPrompt,
        config: { responseMimeType: "application/json" }
      });

      const rankRaw = rankResponse.text;
      if (!rankRaw) throw new Error("Ranking engine failed");
      const rankings = JSON.parse(rankRaw);

      const finalMatches = rankings.map((r: any) => {
        const expert = experts.find(e => String(e.id) === String(r.id));
        return expert ? { ...expert, matchDetails: r } : null;
      }).filter(Boolean);

      const resultData: MatchResponse = { analysis, matches: finalMatches };
      setResult(resultData);

      // Persist to Firestore
      if (auth.currentUser) {
        try {
          const docRef = await addDoc(collection(db, 'matches'), {
            userId: auth.currentUser.uid,
            input: finalReq,
            analysis,
            matches: finalMatches,
            timestamp: Date.now(),
            selectedExpertId: null
          });
          setCurrentMatchId(docRef.id);
        } catch (dbErr) {
          console.error("Failed to save match history:", dbErr);
        }
      }
    } catch (err: any) {
      console.error('Match Engine Error:', err);
      setError(err.message || 'Semantic matching unavailable. Check network or pool sync.');
    } finally {
      setLoading(false);
    }
  };

  const selectExpert = async (expertId: string) => {
    if (!currentMatchId || !auth.currentUser) return;

    try {
      const matchRef = doc(db, 'matches', currentMatchId);
      await updateDoc(matchRef, {
        selectedExpertId: expertId
      });
      
      setResult(prev => {
        if (!prev) return null;
        return { ...prev, selectedExpertId: expertId };
      });
    } catch (err) {
      console.error("Failed to persist expert selection:", err);
    }
  };

  const restoreSession = useCallback((entry: { input: string, analysis: any, matches: any[], chatHistory: any[], id: string }) => {
    setInput(entry.input);
    setResult({ 
      analysis: entry.analysis, 
      matches: entry.matches, 
      selectedExpertId: (entry as any).selectedExpertId 
    });
    setCurrentMatchId(entry.id);
    setError('');
  }, []);

  return (
    <MatchingContext.Provider value={{ 
      input, setInput, loading, result, error, setError, handleMatch, selectExpert, currentMatchId, resetMatching, restoreSession 
    }}>
      {children}
    </MatchingContext.Provider>
  );
};

export const useMatching = () => {
  const context = useContext(MatchingContext);
  if (context === undefined) {
    throw new Error('useMatching must be used within a MatchingProvider');
  }
  return context;
};
