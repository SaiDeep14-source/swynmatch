import http from 'http';
import express from 'express';

const app = express();

app.get('/test', (req:any, res:any) => res.json({ok: true}));

app.listen(3003, () => console.log('started'));

setTimeout(() => {
  const req = http.request({
    hostname: 'localhost',
    port: 3003,
    path: '/test',
    method: 'OPTIONS',
  }, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log('BODY:', body.substring(0, 50)));
    process.exit(0);
  });
  
  req.end();
}, 500);

