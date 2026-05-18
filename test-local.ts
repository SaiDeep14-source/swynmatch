import http from 'http';
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/experts',
  method: 'GET'
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('BODY:', body.substring(0, 100)));
});
req.end();
