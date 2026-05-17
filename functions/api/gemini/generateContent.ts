export async function onRequestPost(context: any) {
  const { request, env } = context;
  
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

    const requestData = await request.json();
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
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
        candidates: data.candidates
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
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestOptions() {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
}
