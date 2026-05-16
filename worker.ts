export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // Handle /api/gemini/generateContent
    if (url.pathname === '/api/gemini/generateContent' || url.pathname === '/api/gemini/generateContent/') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const payload = await request.json() as any;
        let apiKey = env.GEMINI_API_KEY;
        
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Gemini API key not found in Cloudflare properties (env.GEMINI_API_KEY)." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        apiKey = apiKey.trim().replace(/^["'](.*)["']$/, '$1').trim();
        
        if (apiKey === "PLACEHOLDER" || apiKey.length < 10) {
           return new Response(JSON.stringify({ error: "Invalid API key format in Cloudflare properties (env.GEMINI_API_KEY)." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const model = payload.model || "gemini-2.5-flash";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await geminiResponse.json() as any;

        if (!geminiResponse.ok) {
           return new Response(JSON.stringify({ 
             error: data.error?.message || "Gemini API request failed", 
             details: data
           }), {
             status: geminiResponse.status === 403 ? 400 : geminiResponse.status,
             headers: { "Content-Type": "application/json" }
           });
        }

        // Return the exact required format that the client expects (text, usageMetadata, candidates)
        let text = "";
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts) {
            text = data.candidates[0].content.parts.map((p: any) => p.text).join("");
        }

        return new Response(JSON.stringify({
          text,
          usageMetadata: data.usageMetadata,
          candidates: data.candidates
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Worker error: " + err?.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Handle /api/proxy-sheet
    if (url.pathname === '/api/proxy-sheet') {
      const sheetId = url.searchParams.get("id");
      const gid = url.searchParams.get("gid");

      if (!sheetId) {
        return new Response(JSON.stringify({ error: "Missing sheet ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId.replace(/\s+/g, '')}/export?format=csv${gid ? `&gid=${gid.replace(/\s+/g, '')}` : ''}`;
        const response = await fetch(targetUrl);
        const csvText = await response.text();

        if (csvText.trim().startsWith('<')) {
          return new Response(JSON.stringify({ error: "Sheet not public (Anyone with link can view required)" }), {
             status: 401,
             headers: { "Content-Type": "application/json" }
          });
        }

        if (!response.ok) {
            if (response.status === 404) {
                return new Response(JSON.stringify({ error: "Google Sheet not found. Please verify the URL and ensure the sheet still exists. (Status 404)" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" }
                });
            }
            return new Response(JSON.stringify({ error: `Google Sheets returned an error: ${response.status} ${response.statusText}` }), {
                status: response.status >= 400 && response.status < 600 ? response.status : 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(csvText, {
          status: 200,
          headers: { 
            "Content-Type": "text/csv"
          }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Network error fetching sheet: " + err?.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Default: serve assets
    // If you configured [assets] directory = "./dist", Cloudflare will route static files automatically 
    // before hitting fetch(). If fetch() is hit, it means the asset wasn't found (e.g. SPA route like /).
    // So we should try to return index.html for SPA routing.
    // However, in Workers with [assets] binding, if nothing matches, the runtime automatically falls back to asset if defined,
    // but typically we can serve the fallback by requesting the origin or simply returning env.ASSETS.fetch(request) if available.
    try {
      if (env.ASSETS) {
        let response = await env.ASSETS.fetch(request);
        if (response.status === 404) {
          // Serve index.html for SPA
          const indexUrl = new URL(request.url);
          indexUrl.pathname = '/index.html';
          return await env.ASSETS.fetch(new Request(indexUrl, request));
        }
        return response;
      }
    } catch (e) {}

    return new Response("Not Found", { status: 404 });
  }
};
