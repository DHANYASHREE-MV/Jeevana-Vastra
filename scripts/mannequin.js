// AI mannequin presentation for every catalogue item (Google Gemini image model).
//
//   npm run mannequin                          -> drafts for ALL items that don't have one yet
//   npm run mannequin -- <slug> [<slug> ...]   -> (re)generate drafts for specific items
//   npm run mannequin -- --flatlay             -> only flat-lay / hanger photos
//   open server/data/mannequin/review/index.html  -> original vs. draft, side by side
//   npm run mannequin -- --approve <slug> ...  -> publish reviewed drafts   (--approve-all for every draft)
//   npm run images -- . "<photo folder A>" ["<photo folder B>"]   -> approved views become photo #1
//
// The API key is read from .env (GEMINI_API_KEY) on this machine only. It is never written into the site,
// so publishing the static build (GitHub Pages) cannot leak it.
//
// Nothing reaches the store until someone has compared each draft with the original photo: generative models
// can drift on colour, motif or border details, and product authenticity matters more than polish.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}
const gemini = require('../server/tryon/providers/gemini');

const REVIEW = path.join(ROOT, 'server', 'data', 'mannequin', 'review');
const APPROVED = path.join(ROOT, 'server', 'data', 'mannequin', 'approved');
fs.mkdirSync(REVIEW, { recursive: true });
fs.mkdirSync(APPROVED, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'catalog.json'), 'utf8'));
const args = process.argv.slice(2);
const draftFile = (slug) => path.join(REVIEW, `${slug}.png`);

function writeReviewPage() {
  const rows = catalog.products.filter((p) => fs.existsSync(draftFile(p.slug))).map((p) => {
    const approved = fs.existsSync(path.join(APPROVED, `${p.slug}.png`));
    return `<tr><td><b>${p.name}</b><br><code>${p.slug}</code><br>${approved ? '✅ approved' : '⏳ awaiting review'}</td>
      <td><img src="../../../../public/img/products/${p.slug}-0.jpg"></td><td><img src="${p.slug}.png"></td></tr>`;
  }).join('');
  fs.writeFileSync(path.join(REVIEW, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Mannequin review</title>
<style>body{font:14px system-ui;margin:24px;background:#FBF8F3}table{border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd;vertical-align:top}img{height:420px}</style>
<h1>Mannequin drafts: original (left) vs AI draft (right)</h1>
<p>Check colours, motifs, borders, zari and tassels. Approve with <code>npm run mannequin -- --approve &lt;slug&gt;</code>.</p>
<table>${rows}</table>`);
}

if (args[0] === '--approve' || args[0] === '--approve-all') {
  const slugs = args[0] === '--approve-all' ? catalog.products.map((p) => p.slug).filter((s) => fs.existsSync(draftFile(s))) : args.slice(1);
  for (const slug of slugs) {
    if (!fs.existsSync(draftFile(slug))) { console.error(`No draft for ${slug}`); continue; }
    fs.copyFileSync(draftFile(slug), path.join(APPROVED, `${slug}.png`));
    console.log(`approved ${slug}`);
  }
  writeReviewPage();
  console.log('\nNext: npm run images -- . "<photo folder A>" "<photo folder B>"   then rebuild / restart.');
  process.exit(0);
}

if (!gemini.available()) {
  console.error('Add GEMINI_API_KEY=... to the .env file in this folder first (create one at https://aistudio.google.com/apikey).');
  process.exit(1);
}

const { mannequinPrompt } = require('./mannequin-prompts');

(async () => {
  let targets = catalog.products;
  if (args.includes('--flatlay')) targets = targets.filter((p) => p.flatlay);
  const named = args.filter((a) => !a.startsWith('--'));
  if (named.length) targets = targets.filter((p) => named.includes(p.slug));
  else targets = targets.filter((p) => !fs.existsSync(draftFile(p.slug)));
  console.log(`Generating ${targets.length} mannequin draft(s)…`);

  for (const p of targets) {
    const file = path.join(ROOT, 'public', 'img', 'products', `${p.slug}-0.jpg`);
    const garment = `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
    const prompt = mannequinPrompt(p);
    process.stdout.write(`${p.slug} … `);
    try {
      const out = await gemini.generate([{ text: prompt }, gemini.img(garment)], { timeoutMs: 180000 });
      fs.writeFileSync(draftFile(p.slug), Buffer.from(out.split(',')[1], 'base64'));
      console.log('draft saved');
    } catch (e) { console.log(`failed: ${e.message}`); }
  }
  writeReviewPage();
  console.log(`\nReview: ${path.join(REVIEW, 'index.html')}\nApprove: npm run mannequin -- --approve <slug> ...   (or --approve-all)`);
})();
