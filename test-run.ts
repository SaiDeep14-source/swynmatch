import { execSync } from 'child_process';
try {
  execSync('node dist/server.cjs & sleep 2 && kill $(pgrep -f "node dist/server.cjs")');
  console.log("Server started successfully!");
} catch (err: any) {
  console.error("Error:", err.message);
}
