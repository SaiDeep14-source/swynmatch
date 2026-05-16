export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

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
