const http = require('http');

const data = JSON.stringify({
  webhook: {
    enabled: true,
    url: 'https://analisai.me/api/webhooks/evolution',
    webhookByEvents: false,
    webhookBase64: true,
    webhook_base64: true,
    base64: true,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE'
    ]
  }
});

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/webhook/set/analisai_solo',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'apikey': 'analisai_secret_2026'
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
