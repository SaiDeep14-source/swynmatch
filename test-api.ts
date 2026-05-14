async function request() {
  try {
    const r = await fetch("http://localhost:3000/api/health");
    console.log(r.status);
    console.log(await r.text());
  } catch (e) {
    console.error("fetch failed", e);
  }
}
request();
