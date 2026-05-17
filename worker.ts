export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // CORS preflight handle globally
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

    // Handle /api/gemini/generateContent
    if (url.pathname === '/api/gemini/generateContent' || url.pathname === '/api/gemini/generateContent/') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { 
          status: 405, 
          headers: { "Access-Control-Allow-Origin": "*" } 
        });
      }

      try {
        let apiKey = env.GEMINI_API_KEY;
        
        if (!apiKey) {
          return new Response(JSON.stringify({ 
            error: "Deploy Error: Gemini API key is missing. Because you deployed outside of AI Studio (to Cloudflare), you must manually add the GEMINI_API_KEY to your Cloudflare Pages Dashboard (Settings -> Environment variables). AI Studio keys do not automatically sync to your Cloudflare account." 
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }

        const requestData = await request.json();
        
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
           return new Response(JSON.stringify({ 
             error: data.error?.message || "Internal AI Proxy Error",
             details: data
           }), {
             status: geminiResponse.status === 403 ? 400 : geminiResponse.status,
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
        return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // Handle /api/proxy-sheet
    if (url.pathname === '/api/proxy-sheet' || url.pathname === '/api/proxy-sheet/') {
      const sheetId = url.searchParams.get("id");
      const gid = url.searchParams.get("gid");

      if (!sheetId) {
        return new Response(JSON.stringify({ error: "Missing sheet ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      try {
        const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId.replace(/\s+/g, '')}/export?format=csv${gid ? `&gid=${gid.replace(/\s+/g, '')}` : ''}`;
        
        const sheetRes = await fetch(targetUrl);
        const csvText = await sheetRes.text();

        if (csvText.trim().startsWith('<')) {
          return new Response(JSON.stringify({ error: "Sheet not public (Anyone with link can view required)" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        if (!sheetRes.ok) {
           return new Response(JSON.stringify({ error: "Failed to fetch sheet content" }), {
             status: sheetRes.status,
             headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
           });
        }

        return new Response(csvText, {
          status: 200,
          headers: { 
            "Content-Type": "text/csv",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Internal error checking sheet: " + err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // Pass everything else through to assets fallback for SPA
    // If we reach here, it's not an API route. If env.ASSETS is bound, we can fetch index.html
    if (env.ASSETS) {
      return env.ASSETS.fetch(new Request(new URL("/", request.url), request));
    }
    
    return new Response("Not found", { status: 404 });
  }
};
