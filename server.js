const express = require('express');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const port = process.env.PORT || 3000;
const root = __dirname;

const payload = [1, 2, 3, 4, 5]
  .map((n) => fs.readFileSync(path.join(root, `html.gz.b64.part${n}`), 'utf8').trim())
  .join('');

const bundledHtml = zlib
  .gunzipSync(Buffer.from(payload, 'base64'))
  .toString('utf8');

app.disable('x-powered-by');
app.use(express.static(root, {
  index: false,
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'cebu-transport-guide' });
});

app.get('*', (_req, res) => {
  res.type('html').send(bundledHtml);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Cebu Transport Guide listening on port ${port}`);
});
