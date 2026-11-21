// Import mannequin images made by hand (Gemini app / Flow) into the review queue.
//   node scripts/import-mannequins.js "<zip file or folder>"
// Files are matched to products by their leading number (07-anything.png -> item #07 in the kit)
// or by the product slug appearing in the file name. Matches are converted to PNG drafts in
// server/data/mannequin/review/; nothing is published until approved (npm run mannequin -- --approve ...).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Usage: node scripts/import-mannequins.js "<zip or folder>"'); process.exit(1); }
const REVIEW = path.join(ROOT, 'server', 'data', 'mannequin', 'review');
fs.mkdirSync(REVIEW, { recursive: true });
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'catalog.json'), 'utf8')).products;

let dir = src;
if (/\.zip$/i.test(src)) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jv-mq-'));
  // Python's zipfile works on every OS (tar varies: GNU tar in Git Bash can't read zips)
  execFileSync('python', ['-I', '-c', 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', path.resolve(src), dir]);
}
const files = fs.readdirSync(dir, { recursive: true }).map(String)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.includes('__MACOSX'));

const matched = new Map(); const unmatched = [];
for (const f of files) {
  const base = path.basename(f).toLowerCase();
  let p = products.find((x) => base.includes(x.slug));
  const num = /^(\d{1,2})\D/.exec(base);
  if (!p && num) p = products[Number(num[1]) - 1];
  if (p) matched.set(p.slug, path.join(dir, f)); else unmatched.push(f);
}

// Convert to PNG with Pillow (already used by the image pipeline); fall back to a plain copy.
for (const [slug, file] of matched) {
  const dest = path.join(REVIEW, `${slug}.png`);
  try {
    execFileSync('python', ['-I', '-c', 'import sys;from PIL import Image,ImageOps;ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB").save(sys.argv[2])', file, dest]);
  } catch { fs.copyFileSync(file, dest); }
  console.log(`imported ${slug}`);
}
if (unmatched.length) console.log(`\nCould not match: ${unmatched.join(', ')}`);
console.log(`\n${matched.size} draft(s) ready for review in ${REVIEW}`);
