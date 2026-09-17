const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const root = __dirname;

app.disable('x-powered-by');
app.use(express.static(root, {
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
  res.sendFile(path.join(root, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Cebu Transport Guide listening on port ${port}`);
});
