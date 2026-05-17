export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);

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
    
    // Cloudflare workers `fetch`
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
