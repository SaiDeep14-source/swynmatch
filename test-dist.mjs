import http from "http";

async function run() {
  const req = http.request({
    method: 'GET',
    host: '127.0.0.1',
    port: 3000,
    path: '/api/proxy-sheet?id=1TO0fGH8KaFw0iX-Xn_aFkSLV7O461y_zimoWVByKrjk',
  }, (res) => {
    let body = "";
    res.on("data", c => body += c);
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Headers:", res.headers);
      console.log("Body preview:", body.substring(0, 100));
    });
  });
  req.on('error', (err) => console.log("Request err:", err.message));
  req.end();

  const req2 = http.request({
    method: 'POST',
    host: '127.0.0.1',
    port: 3000,
    path: '/api/gemini/generateContent',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let body = "";
    res.on("data", c => body += c);
    res.on("end", () => {
      console.log("POST Status:", res.statusCode);
      console.log("POST Headers:", res.headers);
      console.log("POST Body preview:", body.substring(0, 100));
    });
  });
  req2.write(JSON.stringify({contents:[{parts:[{text:"hello"}]}]}));
  req2.end();
}
run();
