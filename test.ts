async function run() {
  try {
    const r = await fetch("http://localhost:3000/api/gemini/generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3-pro",
        contents: "Hello"
      })
    });
    console.log(r.status);
    console.log(await r.text());
  } catch (e) {
    console.error(e);
  }
}
run();
