export async function onRequest(context: any) {
  const { request, env } = context;
  
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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const key = env.GEMINI_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ 
        error: "Deploy Error: Gemini API key is missing. Because you deployed using Cloudflare Pages, you must manually add the GEMINI_API_KEY to your Cloudflare Dashboard (Pages -> Settings -> Environment variables). AI Studio keys do not automatically sync to third-party hosts." 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const requestData = await request.json();
    
    // Default model if none provided
    if (!requestData.model) {
      requestData.model = "gemini-2.5-flash";
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${requestData.model}:generateContent?key=${key}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData)
    });

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
        candidates: data.candidates,
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || ""
    }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
    });
  } catch (err: any) {
    let errorMsg = err?.message || "Internal AI Proxy Error";
    if (errorMsg.includes("fetch")) {
      errorMsg = "Network error while connecting to Gemini API.";
    }
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
