export async function onRequestGet(context) {
  return new Response(JSON.stringify({ 
    status: "ok", 
    time: new Date().toISOString(),
    platform: "cloudflare-pages"
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
