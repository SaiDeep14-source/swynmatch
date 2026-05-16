export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  // Only allow POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const key = env.GEMINI_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ 
        error: "Deploy Error: Gemini API key is missing. Because you deployed outside of AI Studio, you must manually add the GEMINI_API_KEY to your hosting provider's Dashboard (Vercel/Cloudflare Settings -> Environment variables). AI Studio keys do not automatically sync to third-party hosts." 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const payload = await request.json();
    if (!payload.model) {
      payload.model = "gemini-2.5-flash"; // Enforce the required default
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${key}`;
    
    // Cloudflare Pages abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();
    
    if (!response.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || "Internal AI Proxy Error" }), {
            status: response.status >= 400 && response.status < 500 ? response.status : 400,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
        });
    }

    return new Response(JSON.stringify({
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        usageMetadata: data.usageMetadata,
        candidates: data.candidates
    }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
    });
  } catch (err) {
    let errorMsg = err?.message || "Internal AI Proxy Error";
    if (err.name === 'AbortError') {
        errorMsg = "Gemini API timeout exceeded (30s)";
    }
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
