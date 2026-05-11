import { MatchResponse, ChatMessage } from '../types';

// Centralized API caller for Gemini proxy
export const generateGeminiContent = async (reqBody: any) => {
  const url = "/api/gemini/generateContent";
  console.info(`Requesting AI via proxy: ${url}`);
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody)
  });

  if (!res.ok) {
    let errorMessage = "AI Request failed";
    try {
      const errData = await res.json();
      errorMessage = errData.error || errorMessage;
    } catch (e) {
      // Not JSON, probably an HTML 404/500
      console.error("Non-JSON error response from API:", e);
    }
    throw new Error(errorMessage);
  }

  return await res.json();
};
