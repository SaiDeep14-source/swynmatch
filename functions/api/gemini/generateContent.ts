export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const key = env.GEMINI_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: "Gemini API key not found in platform settings." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const payload = await request.json();
    if (!payload.model || payload.model !== "gemini-pro") {
      payload.model = "gemini-pro"; // Enforce the requested model
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
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        usageMetadata: data.usageMetadata,
        candidates: data.candidates
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    let errorMsg = err?.message || "Internal AI Proxy Error";
    if (err.name === 'AbortError') {
        errorMsg = "Gemini API timeout exceeded (30s)";
    }
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
