// Build a do-it-yourself mannequin kit for the Gemini app / Flow (no API key needed).
//   node scripts/make-mannequin-kit.js "<output folder>"
// Output: photos/NN-<slug>.jpg (upload these), Mannequin prompts.html (copy-paste prompts), prompts.txt
const fs = require('node:fs');
const path = require('node:path');
const { mannequinPrompt } = require('./mannequin-prompts');

const ROOT = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('Usage: node scripts/make-mannequin-kit.js "<output folder>"'); process.exit(1); }
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'catalog.json'), 'utf8'));
fs.mkdirSync(path.join(out, 'photos'), { recursive: true });
fs.mkdirSync(path.join(out, 'mannequins'), { recursive: true });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const items = catalog.products.map((p, i) => {
  const n = String(i + 1).padStart(2, '0');
  const photo = `${n}-${p.slug}.jpg`;
  fs.copyFileSync(path.join(ROOT, 'public', 'img', 'products', `${p.slug}-0.jpg`), path.join(out, 'photos', photo));
  return { n, p, photo, save: `${n}-${p.slug}.png`, prompt: mannequinPrompt(p) };
});

fs.writeFileSync(path.join(out, 'prompts.txt'), items.map((it) =>
  `#${it.n}  ${it.p.name}\nUpload: photos/${it.photo}\nSave result as: ${it.save}\nPrompt:\n${it.prompt}\n`).join('\n----------------------------------------\n\n'));

fs.writeFileSync(path.join(out, 'Mannequin prompts.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mannequin Prompt Kit</title>
<style>
:root{--ivory:#FBF8F3;--maroon:#6E1E2B;--gold:#B08D57;--line:#E6DCCD;--ink:#3B2E25}
*{box-sizing:border-box}body{margin:0;background:var(--ivory);color:var(--ink);font:15px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif}
header{background:var(--maroon);color:#F1E6CF;padding:28px 16px}header div,main{max-width:1000px;margin:0 auto}
h1{font:600 30px Georgia,serif;margin:0 0 8px}ol.steps{margin:12px 0 0;padding-left:20px}ol.steps li{margin:4px 0}
main{padding:20px 16px 60px}.bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px;font-size:14px}
.card{display:grid;grid-template-columns:150px 1fr;gap:16px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:14px}
.card.done{opacity:.55}.card img{width:150px;aspect-ratio:3/4;object-fit:cover;border-radius:6px;background:#eee}
.num{display:inline-block;background:var(--maroon);color:#fff;border-radius:999px;padding:1px 10px;font-size:13px;margin-right:6px}
h2{font:600 19px Georgia,serif;margin:0 0 6px}.meta{font-size:13px;color:#7a6a5c;margin-bottom:8px}.meta code{background:#F1E6CF;padding:1px 6px;border-radius:4px;color:var(--ink)}
textarea{width:100%;min-height:118px;font:13px/1.45 ui-monospace,Consolas,monospace;border:1px solid var(--line);border-radius:6px;padding:8px;resize:vertical;background:#FFFDF9}
.row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center}
button{font:inherit;font-size:13px;border:1px solid var(--maroon);background:var(--maroon);color:#fff;border-radius:6px;padding:7px 14px;cursor:pointer}
button.ghost{background:#fff;color:var(--maroon)}label{font-size:13px;display:flex;gap:6px;align-items:center;cursor:pointer}
@media (max-width:600px){.card{grid-template-columns:1fr}.card img{width:120px}}
</style></head><body>
<header><div><h1>Jeevana Vastra: Mannequin Prompt Kit</h1>
<ol class="steps">
<li>Open <b>gemini.google.com</b> (or Flow) and pick the image model (Nano Banana / "Create images").</li>
<li>For each item: start a <b>new chat</b>, attach the photo from the <b>photos</b> folder, paste the prompt (Copy button), send.</li>
<li>If the result changes the colours, motifs or border, regenerate. Only keep results that match the original.</li>
<li>Download the image and save it in the <b>mannequins</b> folder <b>with the name shown</b> (the number at the start is what matters).</li>
<li>When done (or after a batch), zip the <b>mannequins</b> folder and upload the zip in the Claude chat.</li>
</ol></div></header>
<main>
<div class="bar"><b id="count"></b><span>Ticks are remembered in this browser.</span></div>
${items.map((it) => `<section class="card" data-n="${it.n}">
<img src="photos/${esc(it.photo)}" alt="${esc(it.p.name)}">
<div><h2><span class="num">#${it.n}</span>${esc(it.p.name)}</h2>
<div class="meta">Upload <code>photos/${esc(it.photo)}</code> · Save as <code>${esc(it.save)}</code></div>
<textarea readonly>${esc(it.prompt)}</textarea>
<div class="row"><button data-copy>Copy prompt</button><button class="ghost" data-copyname>Copy file name</button>
<label><input type="checkbox" data-done> Done</label></div></div></section>`).join('\n')}
</main>
<script>
const KEY='jv_mq_done';let done=new Set();try{done=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch(e){}
const cards=[...document.querySelectorAll('.card')];
function sync(){cards.forEach(c=>{const on=done.has(c.dataset.n);c.classList.toggle('done',on);c.querySelector('[data-done]').checked=on});
document.getElementById('count').textContent=done.size+' of '+cards.length+' done';try{localStorage.setItem(KEY,JSON.stringify([...done]))}catch(e){}}
async function copy(text,btn){try{await navigator.clipboard.writeText(text)}catch(e){const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove()}
const o=btn.textContent;btn.textContent='Copied ✓';setTimeout(()=>btn.textContent=o,1200)}
document.addEventListener('click',e=>{const c=e.target.closest('.card');if(!c)return;
if(e.target.matches('[data-copy]'))copy(c.querySelector('textarea').value,e.target);
if(e.target.matches('[data-copyname]'))copy(c.querySelector('.meta code:last-child').textContent,e.target)});
document.addEventListener('change',e=>{if(!e.target.matches('[data-done]'))return;const n=e.target.closest('.card').dataset.n;e.target.checked?done.add(n):done.delete(n);sync()});
sync();
</script></body></html>`);
console.log(`Kit ready: ${items.length} items → ${out}`);
