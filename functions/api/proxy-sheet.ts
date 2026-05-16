export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const sheetId = url.searchParams.get("id");
  const gid = url.searchParams.get("gid");
  
  if (!sheetId) {
    return new Response(JSON.stringify({ error: "Missing sheet ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
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
            return new Response(JSON.stringify({ error: "Google Sheet not found. Please verify the URL and ensure the sheet still exists." }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response(csvText, {
      status: 200,
      headers: { 
        "Content-Type": "text/csv"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Network error fetching sheet: " + err?.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
