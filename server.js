const express = require('express');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const app = express();
const port = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Conservative security headers that do not interfere with the external map tiles/CDN.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

function buildIndex() {
  const parts = fs.readdirSync(__dirname)
    .filter((name) => /^html\.gz\.b64\.part\d+$/.test(name))
    .sort((a, b) => Number(a.match(/part(\d+)$/)[1]) - Number(b.match(/part(\d+)$/)[1]));

  if (!parts.length) {
    throw new Error('Bundled frontend parts are missing.');
  }

  const encoded = parts
    .map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8'))
    .join('');

  return zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
}

const indexHtml = buildIndex();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'cebu-transport-guide' });
});

app.get('/manifest.json', (_req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('html').send(indexHtml);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Cebu Transport Guide listening on port ${port}`);
});
