// Virtual Try-On studio page.
// Photo (upload / camera) stays in memory; switching garments reuses it. Results are cached per garment.
import { api, catalog } from '../api.js';
import { cart } from '../store.js';
import { flyToBag } from '../effects.js';
import { $, $$, esc, inr, img, icons, setMeta, toast, toUrl } from '../ui.js';
import { materialsFor, matches, swatchStyle } from '../materials.js';

// AI pipeline steps shown while a look is being created (on-device stage messages map onto these).
const AI_STEPS = ['Loading AI models', 'Reading your pose', 'Isolating the fabric', 'Mapping the drape', 'Rendering your look'];
const STEP_OF = { 'Loading on-device AI models…': 0, 'Detecting your pose…': 1, 'Extracting the garment…': 2, 'Fitting the drape to your body…': 3, 'Rendering your look…': 4, 'Uploading to the photoreal AI…': 0, 'Waiting for a free AI GPU…': 1, 'Draping the garment on you…': 3 };

const FILTERS = [['all', 'All'], ['sarees', 'Sarees'], ['kurta-sets', 'Kurta sets'], ['dresses', 'Anarkalis'], ['kurtis', 'Kurtis'], ['co-ord-sets', 'Co-ords']];
const LOOKS_KEY = 'jv_saved_looks';

export async function render({ el, query, navigate }) {
  setMeta('Virtual Try-On Studio', 'Upload a photo and try any Jeevana Vastra outfit on yourself with AI.');
  const [{ products }, config] = await Promise.all([catalog.products({ sort: 'popular' }), api.get('/tryon/config')]);

  const s = {
    product: products.find((p) => p.slug === query.product) || null,
    filter: 'all',
    material: query.material || 'all',
    photo: null,          // { canvas, dataUrl, key }
    results: new Map(),   // `${mode}:${slug}` -> dataUrl
    view: 'compare',
    mode: config.cloud ? 'cloud' : 'hf',
    busy: false,
    stream: null,
    size: null,
  };
  if (s.product) s.filter = 'all';

  const mats = materialsFor(products);
  el.innerHTML = `<div class="studio-page dark-zone">
  <div class="aurora"></div><div class="holo-grid"></div><div class="noise"></div>
  <section class="studio-hero">
    <div class="container">
      <span class="ai-badge"><i></i> AI Atelier · Virtual Try-On</span>
      <h1 class="glitch" data-text="Wear it before you buy it.">Wear it <span class="grad">before</span> you buy it.</h1>
      <p>Choose a material, pick any piece from the catalogue and add your photo. Our AI reads your pose, maps the drape and dresses you. Switch outfits instantly, compare before and after, and save your looks.</p>
      <span class="engine-pill"><i></i>${config.cloud ? `Photoreal cloud AI: ${esc(config.providers.map((p) => p.label).join(', '))}` : 'Photoreal generative AI (IDM-VTON) · instant on-device AI as backup'}</span>
    </div>
  </section>
  <div class="container">
    <div class="studio">
      <aside class="studio-col studio-picker">
        <h2><span class="n">1</span>Material &amp; outfit</h2>
        <div class="step-label">Select a material</div>
        <div class="mat-rail" id="matRail"></div>
        <div class="step-label">Select an outfit <span id="pickCount" style="color:rgba(247,238,221,.5)"></span></div>
        <div class="picker-filters">${FILTERS.map(([k, l]) => `<button data-filter="${k}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="picker-list" id="picker"></div>
      </aside>

      <section class="studio-col studio-stage stage">
        <h2><span class="n">2</span>Your photo &amp; look</h2>
        <p class="sub" id="stageSub">Upload a full or half-length, front-facing photo in good light.</p>
        <div class="stage-frame" id="frame"></div>
        <div class="view-toggle" id="viewToggle" hidden>
          <button data-view="compare" class="on">Before / After</button><button data-view="after">Look</button><button data-view="before">Original</button>
        </div>
        <div class="stage-tools" id="tools" hidden>
          <div class="group">
            <button class="btn btn-ghost btn-sm" id="changePhoto">${icons.upload} New photo</button>
            <button class="btn btn-ghost btn-sm" id="retake">${icons.camera} Camera</button>
          </div>
          <div class="group">
            <button class="btn btn-ghost btn-sm" id="saveLook" disabled>♡ Save look</button>
            <button class="btn btn-outline btn-sm" id="download" disabled>${icons.download} Download</button>
          </div>
        </div>
        <input type="file" id="file" accept="image/jpeg,image/png,image/webp" hidden>
      </section>

      <aside class="studio-col studio-side">
        <h2><span class="n">3</span>Love it? Shop it</h2>
        <div id="selected"></div>
        <div class="mode-switch">
          ${config.cloud ? `<label class="mode"><input type="radio" name="mode" value="cloud" ${s.mode === 'cloud' ? 'checked' : ''}><span><b>Photoreal (premium AI)</b><small>Generative try-on with realistic drape, folds and lighting.</small></span></label>` : ''}
          <label class="mode"><input type="radio" name="mode" value="hf" ${s.mode === 'hf' ? 'checked' : ''}><span><b>Photoreal (free AI · beta)</b><small>Redraws the outfit on you with realistic folds and lighting, in about 15–60 s. Your photo is sent to a free public AI service (IDM-VTON on Hugging Face) to create the look. Best results with a full-length photo.</small></span></label>
          <label class="mode"><input type="radio" name="mode" value="local" ${s.mode === 'local' ? 'checked' : ''}><span><b>Instant (on-device AI)</b><small>Pose-aware garment fitting that runs in your browser. Your photo never leaves your device.</small></span></label>
        </div>
        <div id="savedWrap"></div>
        <div class="privacy">${icons.shield}<span>Your photo is only used to create your look. ${config.cloud ? 'Cloud looks are generated in memory and never stored on our servers.' : 'In on-device mode it never leaves your browser.'} Saved looks stay on this device.</span></div>
      </aside>
    </div>
  </div>
  </div>`;

  const frame = $('#frame', el);
  const fileInput = $('#file', el);

  // ---------- picker ----------
  const drawMaterials = () => {
    $('#matRail', el).innerHTML = `<button class="mat-chip all ${s.material === 'all' ? 'on' : ''}" data-mat="all"><span class="sw"></span><span><b>All fabrics</b><small>${products.length} styles</small></span></button>`
      + mats.map((m) => `<button class="mat-chip ${s.material === m.key ? 'on' : ''}" data-mat="${m.key}"><span class="sw" style="${swatchStyle(m)}"></span><span><b>${esc(m.label)}</b><small>${esc(m.note)}</small></span></button>`).join('');
  };
  drawMaterials();
  const drawPicker = () => {
    const list = products.filter((p) => (s.filter === 'all' || p.category === s.filter) && matches(p, s.material));
    $('#pickCount', el).textContent = `· ${list.length}`;
    if (!list.length) { $('#picker', el).innerHTML = '<p class="sub" style="grid-column:1/-1">No styles in this material and category yet. Try another combination.</p>'; return; }
    $('#picker', el).innerHTML = list.map((p) => {
      const done = [...s.results.keys()].some((k) => k.endsWith(`:${p.slug}`));
      const localOnly = !config.cloud && p.flatlay;
      return `<button class="pick ${s.product?.slug === p.slug ? 'on' : ''}" data-pick="${p.slug}" aria-pressed="${s.product?.slug === p.slug}">
        <img src="${img(p.images[0])}" alt="" loading="lazy">
        ${done ? '<span class="done-dot">Tried</span>' : localOnly ? '<span class="cloud-only">Photoreal only</span>' : ''}
        <span>${esc(p.name)}<b>${inr(p.price)}</b></span></button>`;
    }).join('');
  };
  drawPicker();

  // ---------- selected product panel ----------
  const drawSelected = () => {
    const p = s.product;
    if (!p) { $('#selected', el).innerHTML = '<p class="sub">Pick an outfit from the catalogue to begin.</p>'; return; }
    if (!p.sizes.includes(s.size)) s.size = p.sizes.length === 1 ? p.sizes[0] : null;
    $('#selected', el).innerHTML = `
      <div class="sel-product"><img src="${img(p.images[0])}" alt="">
        <div><span class="card-cat">${esc(p.categoryName)}</span><h3>${esc(p.name)}</h3>
        <div class="price"><b>${inr(p.price)}</b>${p.mrp > p.price ? `<s>${inr(p.mrp)}</s><span class="off">${p.discount}% off</span>` : ''}</div></div></div>
      <div class="opt-label" style="margin-top:16px">Size</div>
      <div class="size-chips">${p.sizes.map((z) => `<button class="chip ${s.size === z ? 'on' : ''}" data-tsize="${z}" ${p.stock[z] ? '' : 'disabled'}>${z}</button>`).join('')}</div>
      <div class="side-actions">
        <button class="btn" id="tAdd" ${p.inStock ? '' : 'disabled'}>${icons.bag} ${p.inStock ? 'Add to bag' : 'Sold out'}</button>
        <a class="btn btn-ghost" href="product/${p.slug}">View product details</a>
      </div>`;
  };
  drawSelected();

  // ---------- saved looks (per-device convenience) ----------
  const readLooks = () => { try { return JSON.parse(localStorage.getItem(LOOKS_KEY) || '[]'); } catch { return []; } };
  const drawLooks = () => {
    const looks = readLooks();
    $('#savedWrap', el).innerHTML = looks.length ? `<div class="opt-label" style="margin-top:20px">Saved looks <span>${looks.length}</span></div>
      <div class="looks">${looks.map((l, i) => `<button data-look="${i}" title="${esc(l.name)}"><img src="${l.thumb}" alt="${esc(l.name)}"></button>`).join('')}</div>` : '';
  };
  drawLooks();

  // ---------- stage rendering ----------
  const key = () => `${s.mode}:${s.product?.slug}`;
  const drawStage = (overlay = '') => {
    stopCamera();
    const result = s.product && s.results.get(key());
    $('#viewToggle', el).hidden = !result;
    $('#tools', el).hidden = !s.photo;
    $('#download', el).disabled = !result; $('#saveLook', el).disabled = !result;
    if (!s.photo) {
      frame.innerHTML = `<div class="stage-empty">
        <div class="big-ic">${icons.user}</div>
        <h3>Add your photo</h3>
        <p>Stand straight, facing the camera, arms slightly away from your body. Plain backgrounds work best.</p>
        <div class="stage-actions">
          <button class="btn" data-act="upload">${icons.upload} Upload photo</button>
          <button class="btn btn-outline" data-act="camera">${icons.camera} Use camera</button>
        </div>
        <p class="drop-hint">or drag &amp; drop an image here · JPG, PNG or WebP</p>
        <ul class="tips" style="text-align:left;display:inline-block;margin-top:10px"><li>Head to at least knees in frame</li><li>One person only, no heavy shadows</li></ul>
      </div>${overlay}`;
      return;
    }
    if (!result) {
      frame.innerHTML = `<div class="single-view"><img src="${s.photo.dataUrl}" alt="Your photo"></div>${overlay || (s.product ? '' : '<div class="processing"><div><b>Now choose a material &amp; outfit</b><small>Pick any style from the catalogue to try it on.</small></div></div>')}`;
      return;
    }
    if (s.view === 'compare') {
      frame.innerHTML = `<div class="compare" id="compare" style="--pos:50%">
        <img src="${s.photo.dataUrl}" alt="Before"><img class="after" src="${result}" alt="After: wearing ${esc(s.product.name)}">
        <span class="lbl l">Before</span><span class="lbl r">After</span><div class="handle"></div></div>${overlay}`;
      bindCompare($('#compare', frame));
    } else {
      frame.innerHTML = `<div class="single-view"><img src="${s.view === 'after' ? result : s.photo.dataUrl}" alt=""></div>${overlay}`;
    }
  };

  const processingHtml = (msg, mode) => `<div class="ai-hud"><div class="grid-scan"></div></div>
    <span class="corner tl" style="z-index:6"></span><span class="corner tr" style="z-index:6"></span><span class="corner bl" style="z-index:6"></span><span class="corner br" style="z-index:6"></span>
    <div class="processing"><div><div class="ai-pct" id="aiPct">0%</div><b id="stageMsg">${esc(msg)}</b>
      <ol class="ai-steps" id="aiSteps">${AI_STEPS.map((t, i) => `<li class="${i === 0 ? 'on' : ''}">${t}</li>`).join('')}</ol>
      <small style="display:block;margin-top:12px">${mode === 'cloud' ? 'Photoreal looks take about 10–30 seconds' : 'First run downloads the AI models (~10 MB)'}</small></div></div><div class="scan"></div>`;
  // Progress: real stage messages advance the steps; the percentage eases toward the current step's ceiling.
  let pctTimer = null; let pct = 0; let ceiling = 18;
  const setStep = (i) => {
    $$('#aiSteps li', frame).forEach((li, k) => { li.className = k < i ? 'done' : k === i ? 'on' : ''; });
    ceiling = Math.min(96, 18 + i * 20);
  };
  const startPct = () => {
    pct = 0; ceiling = 18; clearInterval(pctTimer);
    pctTimer = setInterval(() => { pct += (ceiling - pct) * 0.08; const e = $('#aiPct', frame); if (e) e.textContent = `${Math.round(pct)}%`; }, 120);
  };
  const stopPct = () => clearInterval(pctTimer);

  function bindCompare(box) {
    const set = (clientX) => { const r = box.getBoundingClientRect(); box.style.setProperty('--pos', `${Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100))}%`); };
    let drag = false;
    box.addEventListener('pointerdown', (e) => { drag = true; box.setPointerCapture(e.pointerId); set(e.clientX); });
    box.addEventListener('pointermove', (e) => { if (drag) set(e.clientX); });
    box.addEventListener('pointerup', () => { drag = false; });
    box.tabIndex = 0; box.setAttribute('role', 'slider'); box.setAttribute('aria-label', 'Before and after comparison');
    box.addEventListener('keydown', (e) => {
      const cur = parseFloat(box.style.getPropertyValue('--pos')) || 50;
      if (e.key === 'ArrowLeft') box.style.setProperty('--pos', `${Math.max(0, cur - 5)}%`);
      if (e.key === 'ArrowRight') box.style.setProperty('--pos', `${Math.min(100, cur + 5)}%`);
    });
  }

  // ---------- photo intake ----------
  async function setPhoto(source) {
    const { canvasFrom } = await import('../tryon/local-engine.js');
    const canvas = canvasFrom(source, 1024);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    s.photo = { canvas, dataUrl, key: `${Date.now()}-${Math.random()}` };
    s.results.clear();
    drawPicker();
    $('#stageSub', el).textContent = 'Drag the slider to compare. Pick another outfit to switch instantly.';
    drawStage();
    if (s.product) generate();
  }

  async function handleFile(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('Please choose a JPG, PNG or WebP image', { type: 'error' }); return; }
    if (file.size > 15 * 1024 * 1024) { toast('That photo is over 15 MB, so please choose a smaller one', { type: 'error' }); return; }
    const url = URL.createObjectURL(file);
    try { const { loadImage } = await import('../tryon/local-engine.js'); await setPhoto(await loadImage(url)); } finally { URL.revokeObjectURL(url); }
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { toast('Camera is not available in this browser, so please upload a photo instead', { type: 'error' }); return; }
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
    } catch { toast('Camera permission was denied. You can upload a photo instead.', { type: 'error' }); return; }
    frame.innerHTML = `<div class="camera-box"><video autoplay playsinline muted></video><div class="guide"></div>
      <div class="cam-bar"><button class="btn btn-light btn-sm" data-act="cam-cancel">Cancel</button><button class="shutter" data-act="shutter" aria-label="Take photo (3 second timer)"></button></div></div>`;
    const video = $('video', frame);
    video.srcObject = s.stream;
  }
  function stopCamera() { if (s.stream) { s.stream.getTracks().forEach((t) => t.stop()); s.stream = null; } }
  async function capture() {
    const video = $('video', frame);
    if (!video) return;
    for (const n of [3, 2, 1]) {
      const cd = document.createElement('div'); cd.className = 'countdown'; cd.textContent = n;
      $('.camera-box', frame)?.append(cd);
      await new Promise((r) => setTimeout(r, 800)); cd.remove();
    }
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
    const ctx = c.getContext('2d'); ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0);
    stopCamera();
    await setPhoto(c);
  }

  // ---------- generation ----------
  async function generate() {
    if (!s.photo || !s.product || s.busy) return;
    const p = s.product;
    let mode = s.mode;
    if (mode === 'local' && p.flatlay) {
      mode = 'hf';
    }
    if (mode === 'local' && p.flatlay) {
      if (config.cloud) mode = 'cloud';
      else {
        drawStage(`<div class="processing"><div style="max-width:360px"><b>This piece is photographed flat</b><small>The on-device engine needs a garment shown on a model. Flat-lay drapes like this saree need the photoreal cloud AI. Pick a style without the "Photoreal only" tag to try it now.</small></div></div>`);
        return;
      }
    }
    if (mode === 'cloud' && p.garment === 'saree' && !config.sareeSupported) mode = 'local';
    const k = `${mode}:${p.slug}`;
    if (s.results.has(k)) { s.mode = mode; drawStage(); return; }

    s.busy = true;
    drawStage(processingHtml(mode === 'local' ? 'Preparing on-device AI…' : 'Weaving your look with AI…', mode === 'local' ? 'local' : 'cloud'));
    startPct();
    let cloudTick = null;
    const stage = (m) => { const e = $('#stageMsg', frame); if (e) e.textContent = m; if (m in STEP_OF) setStep(STEP_OF[m]); };
    if (mode !== 'local') { let i = 0; cloudTick = setInterval(() => { i = Math.min(4, i + 1); setStep(i); }, mode === 'hf' ? 7000 : 4000); }
    try {
      let image;
      if (mode === 'cloud') {
        stage('Draping the garment on you…');
        const r = await api.post('/tryon', { productSlug: p.slug, personImage: s.photo.dataUrl });
        image = r.image;
      } else if (mode === 'hf') {
        const { tryOnHF } = await import('../tryon/hf-engine.js');
        // A clean garment reference works best: the mannequin view when there is one, else the product photo.
        const ref = p.images.find((i) => i.endsWith('-mq')) || p.tryonImage || p.images[0];
        image = await tryOnHF({ personDataUrl: s.photo.dataUrl, garmentUrl: `img/products/${ref}.jpg`, description: `${p.color} ${p.name}, ${p.fabric}`, onStage: stage });
      } else {
        const { tryOnLocal } = await import('../tryon/local-engine.js');
        image = await tryOnLocal({ personCanvas: s.photo.canvas, personKey: s.photo.key, product: p, garmentUrl: img(p.tryonImage || p.images[0], 1080), onStage: stage });
      }
      clearInterval(cloudTick); stopPct();
      s.results.set(k, image);
      s.mode = mode;
      $$('input[name="mode"]', el).forEach((r) => { r.checked = r.value === mode; });
      s.busy = false;
      drawStage('<div class="reveal-flash"></div>'); drawPicker();
    } catch (err) {
      clearInterval(cloudTick); stopPct();
      s.busy = false;
      console.error(err);
      // AI chain: premium cloud -> free photoreal -> instant on-device. Fall back automatically.
      if (mode === 'cloud') {
        s.mode = 'hf';
        $$('input[name="mode"]', el).forEach((r) => { r.checked = r.value === 'hf'; });
        toast('Premium AI is unavailable, so we are using the free photoreal AI');
        generate();
        return;
      }
      if (mode === 'hf' && !p.flatlay && !s.hfAutoFallback) {
        s.hfAutoFallback = true;
        s.mode = 'local';
        $$('input[name="mode"]', el).forEach((r) => { r.checked = r.value === 'local'; });
        toast(`${esc(err.message)} Showing the instant on-device look instead.`);
        generate();
        return;
      }
      const fallback = mode !== 'local' && !p.flatlay ? '<button class="btn btn-sm" data-act="use-local" style="margin-top:14px">Try the instant on-device mode</button>' : '';
      drawStage(`<div class="processing"><div style="max-width:380px"><b>We couldn't create this look</b><small>${esc(err.message)}</small>
        <div class="stage-actions"><button class="btn btn-sm" data-act="retry">Try again</button><button class="btn btn-outline btn-sm" data-act="upload">Use another photo</button></div>${fallback}</div></div>`);
    }
  }

  // ---------- events ----------
  el.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      if (s.busy) { toast('Hang on, we are still creating your current look'); return; }
      s.product = products.find((p) => p.slug === pick.dataset.pick);
      history.replaceState(history.state, '', toUrl(`/virtual-try-on?product=${s.product.slug}`));
      drawPicker(); drawSelected();
      if (s.photo) generate(); else drawStage();
      if (window.innerWidth < 860) frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const mt = e.target.closest('[data-mat]');
    if (mt) { s.material = mt.dataset.mat; drawMaterials(); drawPicker(); return; }
    const f = e.target.closest('[data-filter]');
    if (f) { s.filter = f.dataset.filter; $$('[data-filter]', el).forEach((b) => b.classList.toggle('on', b === f)); drawPicker(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'upload') fileInput.click();
    if (act === 'camera') openCamera();
    if (act === 'cam-cancel') { stopCamera(); drawStage(); }
    if (act === 'shutter') capture();
    if (act === 'retry') generate();
    if (act === 'use-local') { s.mode = 'local'; $$('input[name="mode"]', el).forEach((r) => { r.checked = r.value === 'local'; }); generate(); }
    const v = e.target.closest('[data-view]');
    if (v) { s.view = v.dataset.view; $$('[data-view]', el).forEach((b) => b.classList.toggle('on', b === v)); drawStage(); }
    const sz = e.target.closest('[data-tsize]');
    if (sz) { s.size = sz.dataset.tsize; drawSelected(); }
    if (e.target.closest('#tAdd')) {
      if (!s.size) { toast('Please choose a size first'); return; }
      try { await cart.add(s.product.id, s.size, 1); flyToBag($('.sel-product img', el)); toast(`Added to bag · ${esc(s.product.name)} (${s.size})`, { image: img(s.product.images[0]), link: { href: '/bag', label: 'View bag' } }); } catch (err) { toast(esc(err.message), { type: 'error' }); }
    }
    const look = e.target.closest('[data-look]');
    if (look) {
      const l = readLooks()[Number(look.dataset.look)];
      import('../ui.js').then(({ openModal }) => openModal(`<div style="padding:20px;text-align:center"><img src="${l.thumb}" alt="" style="max-height:70vh;margin:0 auto;border-radius:8px"><h3 style="font-size:24px;margin:14px 0">${esc(l.name)}</h3>
        <div class="stage-actions"><a class="btn" href="product/${l.slug}" data-close>View product</a><a class="btn btn-ghost" href="${l.thumb}" download="jeevana-vastra-${l.slug}.jpg">Download</a><button class="btn btn-ghost" data-del-look="${look.dataset.look}" data-close>Remove</button></div></div>`, { narrow: true }));
    }
  });
  document.addEventListener('click', onDelLook);
  function onDelLook(e) {
    const d = e.target.closest('[data-del-look]');
    if (!d) return;
    const looks = readLooks(); looks.splice(Number(d.dataset.delLook), 1);
    try { localStorage.setItem(LOOKS_KEY, JSON.stringify(looks)); } catch { /* ignore */ }
    drawLooks();
  }

  $('#changePhoto', el).addEventListener('click', () => fileInput.click());
  $('#retake', el).addEventListener('click', openCamera);
  fileInput.addEventListener('change', () => { handleFile(fileInput.files[0]); fileInput.value = ''; });
  frame.addEventListener('dragover', (e) => { e.preventDefault(); frame.classList.add('dragging'); });
  frame.addEventListener('dragleave', () => frame.classList.remove('dragging'));
  frame.addEventListener('drop', (e) => { e.preventDefault(); frame.classList.remove('dragging'); handleFile(e.dataTransfer.files[0]); });

  $$('input[name="mode"]', el).forEach((r) => r.addEventListener('change', () => { s.mode = r.value; if (s.photo && s.product) generate(); }));

  $('#download', el).addEventListener('click', async () => {
    const data = await brandedLook();
    const a = document.createElement('a'); a.href = data; a.download = `jeevana-vastra-${s.product.slug}.jpg`; a.click();
  });
  $('#saveLook', el).addEventListener('click', async () => {
    const data = await brandedLook(560);
    const looks = readLooks().filter((l) => l.slug !== s.product.slug);
    looks.unshift({ slug: s.product.slug, name: s.product.name, thumb: data, at: Date.now() });
    try { localStorage.setItem(LOOKS_KEY, JSON.stringify(looks.slice(0, 6))); toast('Look saved to this device'); } catch { toast('Could not save. Browser storage is full or disabled', { type: 'error' }); }
    drawLooks();
  });

  // Result image with a subtle brand caption, for downloads and saved looks.
  async function brandedLook(maxW) {
    const { loadImage } = await import('../tryon/local-engine.js');
    const im = await loadImage(s.results.get(key()));
    const scale = maxW ? Math.min(1, maxW / im.width) : 1;
    const w = Math.round(im.width * scale); const h = Math.round(im.height * scale); const band = Math.round(w * 0.09);
    const c = document.createElement('canvas'); c.width = w; c.height = h + band;
    const ctx = c.getContext('2d');
    ctx.drawImage(im, 0, 0, w, h);
    ctx.fillStyle = '#4A111B'; ctx.fillRect(0, h, w, band);
    ctx.fillStyle = '#F1E6CF'; ctx.font = `600 ${Math.round(band * 0.38)}px "Cormorant Garamond", serif`; ctx.textBaseline = 'middle';
    ctx.fillText('Jeevana Vastra', band * 0.4, h + band / 2);
    ctx.font = `${Math.round(band * 0.24)}px Jost, sans-serif`; ctx.textAlign = 'right';
    ctx.fillText(`${s.product.name} · ${inr(s.product.price)}`, w - band * 0.4, h + band / 2);
    return c.toDataURL('image/jpeg', 0.9);
  }

  drawStage();
  if (s.product) frame.scrollIntoView({ block: 'nearest' });
  return () => { stopCamera(); stopPct(); document.removeEventListener('click', onDelLook); };
}
