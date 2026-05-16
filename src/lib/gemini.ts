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
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errData = await res.json();
        errorMessage = errData.error || errorMessage;
        if (errorMessage && errorMessage.includes('leaked')) {
           errorMessage = "Your Gemini API Key has been reported as leaked by Google. Please generate a new API Key in Google AI Studio and update it in your app settings.";
        }
      } else {
        const textError = await res.text();
        console.error("Non-JSON error response from API:", textError.substring(0, 200));
        errorMessage = `API Error (${res.status}): The server returned an invalid response format. This may happen if ad-blockers or proxies (like AI Studio cookie check) intercept the request. Please try opening the app in a new tab or incognito mode.`;
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
