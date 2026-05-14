import http from "http";
import { spawn } from "child_process";

async function run() {
  const ps = spawn("node", ["dist/server.cjs"], {
    env: { ...process.env, NODE_ENV: "production", PORT: "3003", GEMINI_API_KEY: "fake" },
    stdio: "pipe",
  });
  
  ps.stdout.on("data", d => console.log("[STDOUT]", d.toString().trim()));
  ps.stderr.on("data", d => console.log("[STDERR]", d.toString().trim()));
  
  await new Promise(r => setTimeout(r, 2000));
  
  const req = http.request({
    method: 'GET',
    host: '127.0.0.1',
    port: 3003,
    path: '/api/proxy-sheet?id=1TO0fGH8KaFw0iX-Xn_aFkSLV7O461y_zimoWVByKrjk',
  }, (res) => {
    let body = "";
    res.on("data", c => body += c);
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Body:", body.substring(0, 100));
      ps.kill();
    });
  });
  req.on('error', (err) => console.log("Request err:", err.message));
  req.end();
}
run();
