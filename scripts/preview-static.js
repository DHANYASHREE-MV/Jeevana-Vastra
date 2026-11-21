// Serve dist/ the way GitHub Pages does: under a sub-path, with 404.html for unknown routes.
//   npm run preview:static -- jeevana-vastra   -> http://localhost:4000/jeevana-vastra/
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');
const base = `/${(process.argv[2] || '').split(/[\\/]/).filter(Boolean).pop() || ''}/`.replace('//', '/');
const PORT = Number(process.env.PORT) || 4000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === base.slice(0, -1)) { res.writeHead(301, { Location: base }); return res.end(); }
  if (!url.startsWith(base)) { res.writeHead(404); return res.end('Not found'); }
  let file = path.join(DIST, url.slice(base.length));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': TYPES['.html'] });
  fs.createReadStream(path.join(DIST, '404.html')).pipe(res);
}).listen(PORT, () => console.log(`Static preview at http://localhost:${PORT}${base}`));
