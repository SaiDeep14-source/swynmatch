export async function onRequest(context: any) {
  const { request, env } = context;
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Ensure you send a POST request." }), {
      status: 405, // Can stay 405, but we ensure proper CORS
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const key = env.GEMINI_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ 
        error: "Deploy Error: Gemini API key is missing. Add GEMINI_API_KEY to your Cloudflare Dashboard (Pages -> Settings -> Environment variables)." 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    const requestData = await request.json();
    
    // Default model if none provided
    if (!requestData.model) {
      requestData.model = "gemini-2.5-flash";
    }

    // Convert new SDK format string `contents: "prompt"` into REST API payload `contents: [{parts: [{text: "prompt"}]}]`
    let formattedContents = requestData.contents;
    if (typeof formattedContents === 'string') {
        formattedContents = [{ role: 'user', parts: [{ text: formattedContents }] }];
    }
    
    const restPayload = {
      ...requestData,
      contents: formattedContents
    };
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${requestData.model}:generateContent?key=${key}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(restPayload)
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
