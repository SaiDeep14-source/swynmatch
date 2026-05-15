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
    let errorMessage = `AI request failed (Status: ${res.status})`;
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errData = await res.json();
        errorMessage = errData.error || errorMessage;
      } else {
        const textError = await res.text();
        console.error("Non-JSON error response from API:", textError.substring(0, 200));
        errorMessage = `API Error (${res.status}): ${textError.substring(0, 200) || "The server returned an empty error response."}`;
      }
    } catch (e) {
      console.error("Failed to parse error response:", e);
    }
    throw new Error(errorMessage);
  }

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const textData = await res.text();
    console.error("Non-JSON success response from API:", textData.substring(0, 200));
    throw new Error("Invalid response format from AI API. Expected JSON.");
  }
  
  return await res.json();
};
