// Jeevana Vastra — API + static storefront server.
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');

// Load .env (KEY=VALUE lines) without extra dependencies.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const db = require('./db');
const auth = require('./auth');
const catalog = require('./routes/catalog');
const tryon = require('./tryon');

const app = express();
const PUBLIC = path.join(__dirname, '..', 'public');
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(self), microphone=()',
  });
  next();
});

app.use('/api/tryon', express.json({ limit: '14mb' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', auth.identify);

app.use('/api', catalog.router);
app.use('/api/account', require('./routes/account'));
app.use('/api', require('./routes/shop'));
app.use('/api/tryon', tryon.router);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// SEO: sitemap + robots
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /checkout\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/shop', '/virtual-try-on', '/contact', ...db.prepare('SELECT slug FROM categories').all().map((c) => `/shop/${c.slug}`),
    ...db.prepare('SELECT slug FROM products').all().map((p) => `/product/${p.slug}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${SITE_URL}${u}</loc></url>`).join('')}</urlset>`);
});

app.use(express.static(PUBLIC, {
  index: false,
  setHeaders(res, file) {
    if (/\.(webp|jpg|png|mp4|woff2)$/.test(file)) res.set('Cache-Control', 'public, max-age=604800');
  },
}));

// SPA fallback with per-route <title>/<meta> so shared links and crawlers get useful metadata.
const shell = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
app.get('*', (req, res) => {
  let title = 'Jeevana Vastra — Premium Indian Ethnic Wear';
  let desc = 'Sarees, kurta sets, kurtis and anarkalis, with an AI Virtual Try-On studio. Handpicked ethnic wear from Jeevana Vastra.';
  let image = '/img/site/og-image.jpg';
  const m = /^\/product\/([a-z0-9-]+)/.exec(req.path);
  if (m) {
    const p = catalog.toProduct(db.prepare(`${catalog.BASE} WHERE p.slug = ?`).get(m[1]));
    if (p) { title = `${p.name} | Jeevana Vastra`; desc = p.description; image = `/img/products/${p.images[0]}-1080.webp`; }
  } else if (req.path.startsWith('/virtual-try-on')) {
    title = 'Virtual Try-On Studio | Jeevana Vastra';
    desc = 'See our sarees and kurta sets on you before you buy — upload a photo and try any outfit with AI.';
  }
  res.type('html').send(shell
    .replace('<title>Jeevana Vastra</title>', `<title>${esc(title)}</title>`)
    .replace(/__DESC__/g, esc(desc))
    .replace(/__IMAGE__/g, esc(SITE_URL + image))
    .replace(/__URL__/g, esc(SITE_URL + req.path)));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'That file is too large' : 'Something went wrong' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  const cloud = Object.values(tryon.PROVIDERS).filter((p) => p.available()).map((p) => p.label);
  console.log(`Jeevana Vastra running at http://localhost:${PORT}`);
  console.log(`Virtual Try-On: ${cloud.length ? `cloud AI via ${cloud.join(', ')}` : 'in-browser AI engine (add GEMINI_API_KEY in .env for photoreal cloud try-on)'}`);
});
