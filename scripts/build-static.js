// Build a static copy of the store for GitHub Pages (or any static host).
//
//   npm run build:static -- --base /jeevana-vastra/ --site https://<user>.github.io/jeevana-vastra
//
// Output: dist/  (public/ + data/catalog.json + 404.html SPA fallback + sitemap/robots)
// In the static build the browser answers the API itself (public/js/static-backend.js):
// bag, wishlist, demo accounts and orders live in localStorage, and Virtual Try-On runs
// with the on-device engine. No API keys are ever copied into dist/.
const fs = require('node:fs');
const path = require('node:path');

process.env.DB_FILE = ':memory:';
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
// "--base jeevana-vastra" (repo name) or "--base /jeevana-vastra/"; Git Bash can mangle a leading slash, so keep the last segment.
let base = arg('base', '/').replace(/\\/g, '/');
base = base.includes(':') ? base.split('/').filter(Boolean).pop() : base;
base = `/${base.split('/').filter(Boolean).join('/')}/`.replace('//', '/');
const site = (arg('site', `http://localhost:4000${base}`)).replace(/\/$/, '');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');

const db = require('../server/db');
const { toProduct, BASE: SQL } = require('../server/routes/catalog');

const products = db.prepare(SQL).all().map(toProduct);
const covers = Object.fromEntries(products.map((p) => [p.slug, p.images[0]]));
const categories = db.prepare(`SELECT c.*, COUNT(p.id) AS count FROM categories c LEFT JOIN products p ON p.category = c.slug
  GROUP BY c.slug ORDER BY c.sort`).all().map((c) => ({ slug: c.slug, name: c.name, blurb: c.blurb, count: c.count, image: covers[c.cover] }));

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'data', 'catalog.json'), JSON.stringify({ products, categories }));

const desc = 'Sarees, kurta sets, kurtis and anarkalis, with an AI Virtual Try-On studio. Handpicked ethnic wear from Jeevana Vastra.';
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
  .replace('<base href="/">', `<base href="${base}">`)
  .replace('<title>Jeevana Vastra</title>', '<title>Jeevana Vastra — Premium Indian Ethnic Wear</title>')
  .replace('<script type="module" src="js/app.js"></script>', '<script>window.JV_STATIC = true;</script>\n  <script type="module" src="js/app.js"></script>')
  .replace(/__DESC__/g, desc)
  .replace(/__IMAGE__/g, `${site}/img/site/og-image.jpg`)
  .replace(/__URL__/g, `${site}/`);
if (!html.includes('JV_STATIC')) throw new Error('Could not inject static flag into index.html');
fs.writeFileSync(path.join(DIST, 'index.html'), html);
fs.writeFileSync(path.join(DIST, '404.html'), html); // GitHub Pages SPA fallback for deep links
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

const urls = ['', 'shop', 'virtual-try-on', 'contact', ...categories.map((c) => `shop/${c.slug}`), ...products.map((p) => `product/${p.slug}`)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${site}/${u}</loc></url>`).join('')}</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);

const leaked = ['GEMINI_API_KEY', 'FASHN_API_KEY', 'REPLICATE_API_TOKEN'].map((k) => process.env[k]).filter(Boolean)
  .some((v) => fs.readdirSync(DIST, { recursive: true }).some((f) => /\.(js|html|json)$/.test(f) && fs.readFileSync(path.join(DIST, f), 'utf8').includes(v)));
if (leaked) throw new Error('An API key value was found in dist/. Aborting.');

console.log(`Static site built: ${products.length} products, ${categories.length} categories → dist/ (base ${base})`);
