// On-device virtual try-on engine (no server, no API key).
//
// Pipeline
//   1. Pose detection (MediaPipe PoseLandmarker) on the customer photo AND on the catalogue photo.
//   2. Clothing segmentation (MediaPipe multiclass selfie segmenter) on the catalogue photo to cut
//      out the exact garment; small holes (e.g. the model's crossed arms) are closed and colour-filled.
//   3. A body-aligned mesh (shoulders → hips → knees → ankles, with outer columns for drape) is built
//      on both images; every triangle of the garment is affine-warped onto the customer's body.
//   4. Compositing: soft contact shadow, then the customer's face, hair and hands are layered back
//      on top so the garment sits *under* them.
//
// Each stage is a separate function so it can be swapped for better models later
// (e.g. dense pose / UV mapping for fit, cloth simulation, or a diffusion refiner for fabric).

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const CAT = { background: 0, hair: 1, body: 2, face: 3, clothes: 4, others: 5 };
const LM = { ls: 11, rs: 12, le: 13, re: 14, lw: 15, rw: 16, li: 19, ri: 20, lh: 23, rh: 24, lk: 25, rk: 26, la: 27, ra: 28, nose: 0 };

let enginePromise = null;

export function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const vision = await import(/* webpackIgnore: true */ `${VISION}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const make = async (delegate) => ({
        pose: await vision.PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: 'IMAGE', numPoses: 1 }),
        seg: await vision.ImageSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: SEG_MODEL, delegate }, runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false }),
      });
      try { return await make('GPU'); } catch { return make('CPU'); }
    })().catch((e) => { enginePromise = null; throw e; });
  }
  return enginePromise;
}

// ---------- helpers ----------
export function canvasFrom(source, maxSide = 1024) {
  const w0 = source.naturalWidth || source.videoWidth || source.width;
  const h0 = source.naturalHeight || source.videoHeight || source.height;
  const s = Math.min(1, maxSide / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not load image'));
    im.src = src;
  });
}

async function analyze(engine, canvas) {
  const poseRes = engine.pose.detect(canvas);
  const segRes = engine.seg.segment(canvas);
  const mask = segRes.categoryMask;
  const cat = mask.getAsUint8Array().slice();
  const mw = mask.width; const mh = mask.height;
  segRes.close?.();
  const raw = poseRes.landmarks?.[0];
  const lm = raw ? raw.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height, v: p.visibility ?? 1 })) : null;
  // Category mask may come back at model resolution; resample to canvas size if needed.
  const out = mw === canvas.width && mh === canvas.height ? cat : resampleNearest(cat, mw, mh, canvas.width, canvas.height);
  return { w: canvas.width, h: canvas.height, lm, cat: out };
}

function resampleNearest(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh)) * sw;
    for (let x = 0; x < dw; x++) out[y * dw + x] = src[sy + Math.min(sw - 1, Math.floor((x * sw) / dw))];
  }
  return out;
}

// Separable box blur on a Float32 map (used for morphology + feathering).
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h); const out = new Float32Array(w * h);
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / d;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / d;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

const threshold = (m, t) => { const o = new Float32Array(m.length); for (let i = 0; i < m.length; i++) o[i] = m[i] > t ? 1 : 0; return o; };

// ---------- stage 2: garment extraction ----------
function extractGarment(canvas, info, garmentType) {
  const { w, h, cat } = info;
  let mask = new Float32Array(w * h);
  let count = 0;
  for (let i = 0; i < cat.length; i++) if (cat[i] === CAT.clothes || cat[i] === CAT.others) { mask[i] = 1; count++; }

  // Ghost-mannequin / flat product shots: no person found → separate garment from the plain ivory backdrop.
  if (count < w * h * 0.03) {
    const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const bg = [px[0], px[1], px[2]];
    count = 0;
    for (let i = 0; i < w * h; i++) {
      const d = Math.abs(px[i * 4] - bg[0]) + Math.abs(px[i * 4 + 1] - bg[1]) + Math.abs(px[i * 4 + 2] - bg[2]);
      mask[i] = d > 36 ? 1 : 0; count += mask[i];
    }
  }
  if (count < w * h * 0.02 || count > w * h * 0.7) throw new Error('Could not isolate the garment in this product photo.');

  // Morphological closing (dilate → erode) to bridge gaps left by the model's arms/hands.
  const r = Math.max(4, Math.round(h * 0.022));
  const closed = threshold(boxBlur(threshold(boxBlur(mask, w, h, r), 0.12), w, h, r), 0.88);
  for (let i = 0; i < mask.length; i++) closed[i] = Math.max(closed[i], mask[i]);
  const alpha = boxBlur(closed, w, h, 1);

  // Pull-push colour fill: spread garment colours into the closed holes.
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sctx = src.getContext('2d');
  const id = canvas.getContext('2d').getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) id.data[i * 4 + 3] = mask[i] * 255;
  sctx.putImageData(id, 0, 0);

  const filled = document.createElement('canvas'); filled.width = w; filled.height = h;
  const fctx = filled.getContext('2d');
  const levels = []; let cur = src;
  while (cur.width > 12 && cur.height > 12) {
    const n = document.createElement('canvas'); n.width = Math.ceil(cur.width / 2); n.height = Math.ceil(cur.height / 2);
    n.getContext('2d').drawImage(cur, 0, 0, n.width, n.height);
    levels.push(n); cur = n;
  }
  fctx.imageSmoothingQuality = 'high';
  for (let i = levels.length - 1; i >= 0; i--) fctx.drawImage(levels[i], 0, 0, w, h);
  fctx.drawImage(src, 0, 0);
  const fd = fctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) fd.data[i * 4 + 3] = Math.round(alpha[i] * 255);
  fctx.putImageData(fd, 0, 0);

  let lm = info.lm;
  const shouldersOk = lm && lm[LM.ls].v > 0.3 && lm[LM.rs].v > 0.3 && lm[LM.lh].v > 0.3;
  if (!shouldersOk) lm = pseudoLandmarks(alpha, w, h, garmentType);
  else if (garmentType !== 'kurti') {
    // Long garments hide the ankles; anchor them to the hem (lowest garment pixel) instead of guessing.
    lm = lm.map((p) => ({ ...p }));
    let bottom = 0;
    for (let y = h - 1; y >= 0 && !bottom; y--) for (let x = 0; x < w; x += 2) if (alpha[y * w + x] > 0.5) { bottom = y; break; }
    const hipY = (lm[LM.lh].y + lm[LM.rh].y) / 2;
    if (lm[LM.la].v < 0.5 || lm[LM.ra].v < 0.5) {
      const ankleY = hipY + (bottom - hipY) * 0.9;
      lm[LM.la] = { x: lm[LM.lh].x, y: ankleY, v: 1 }; lm[LM.ra] = { x: lm[LM.rh].x, y: ankleY, v: 1 };
    }
    if (lm[LM.lk].v < 0.5 || lm[LM.rk].v < 0.5) {
      lm[LM.lk] = { ...lerp(lm[LM.lh], lm[LM.la], 0.5), v: 1 }; lm[LM.rk] = { ...lerp(lm[LM.rh], lm[LM.ra], 0.5), v: 1 };
    }
  }
  return { canvas: filled, lm };
}

// Template body points for garments shown without a person (ghost mannequin / flat).
function pseudoLandmarks(alpha, w, h, type) {
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > 0.5) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const H = maxY - minY; const cx = (minX + maxX) / 2; const W = maxX - minX;
  const long = type === 'saree' || type === 'anarkali';
  const ys = long ? { s: 0.03, h: 0.33, k: 0.64, a: 0.97 } : { s: 0.04, h: 0.40, k: 0.78, a: 1.18 };
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: minY, v: 0 }));
  const set = (i, dx, fy) => { lm[i] = { x: cx + dx * W, y: minY + fy * H, v: 1 }; };
  set(LM.ls, 0.2, ys.s); set(LM.rs, -0.2, ys.s);
  set(LM.lh, 0.12, ys.h); set(LM.rh, -0.12, ys.h);
  set(LM.lk, 0.1, ys.k); set(LM.rk, -0.1, ys.k);
  set(LM.la, 0.09, ys.a); set(LM.ra, -0.09, ys.a);
  return lm;
}

// ---------- stage 3: body-aligned mesh + warp ----------
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const mid = (a, b) => lerp(a, b, 0.5);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const len = (a) => Math.hypot(a.x, a.y);

function bodyRows(lm) {
  const ls = lm[LM.ls]; const rs = lm[LM.rs];
  const sw = len(sub(ls, rs));
  const lh = lm[LM.lh]; const rh = lm[LM.rh];
  // Knees/ankles are often out of frame or occluded (sarees, half-body photos) — extrapolate from the torso.
  const torso = sub(mid(lh, rh), mid(ls, rs));
  const pick = (i, fallback) => (lm[i] && lm[i].v > 0.35 ? lm[i] : fallback);
  const lk = pick(LM.lk, add(lh, mul(torso, 0.95))); const rk = pick(LM.rk, add(rh, mul(torso, 0.95)));
  const la = pick(LM.la, add(lk, mul(torso, 0.95))); const ra = pick(LM.ra, add(rk, mul(torso, 0.95)));
  const up = mul(torso, -0.32 * (sw / Math.max(1, len(torso))) * 1.6);
  // Floor-length hems (sarees, palazzos) fall past the ankle joint — extend the mesh to the floor.
  const feet = mul(sub(mid(la, ra), mid(lk, rk)), 0.6);
  // Each row: [b side, a side]; columns are generated outward from the row centre.
  const rows = [
    [add(rs, up), add(ls, up)],
    [rs, ls],
    [rh, lh],
    [rk, lk],
    [ra, la],
    [add(ra, feet), add(la, feet)],
  ];
  // Hip/knee/ankle joints sit inside the body; widen them to the shoulder span so drape is captured.
  const minHalf = sw * 0.5;
  return rows.map(([b, a]) => {
    const c = mid(a, b); let half = sub(a, c);
    if (len(half) < minHalf) half = mul(half, minHalf / Math.max(1, len(half)));
    const dir = len(half) ? half : { x: minHalf, y: 0 };
    return [-3.2, -2.0, -1, 0, 1, 2.0, 3.2].map((k) => add(c, mul(dir, k)));
  });
}

function affine(s, d) {
  const [s0, s1, s2] = s; const [d0, d1, d2] = d;
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(den) < 1e-6) return null;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
  const dd = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / den;
  const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / den;
  return [a, b, c, dd, e, f];
}

function warpGarment(garment, srcRows, dstRows, w, h) {
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  for (let r = 0; r < srcRows.length - 1; r++) {
    for (let c = 0; c < srcRows[r].length - 1; c++) {
      const S = [srcRows[r][c], srcRows[r][c + 1], srcRows[r + 1][c + 1], srcRows[r + 1][c]];
      const D = [dstRows[r][c], dstRows[r][c + 1], dstRows[r + 1][c + 1], dstRows[r + 1][c]];
      for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
        const m = affine([S[i], S[j], S[k]], [D[i], D[j], D[k]]);
        if (!m) continue;
        const tri = [D[i], D[j], D[k]];
        const cen = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, y: (tri[0].y + tri[1].y + tri[2].y) / 3 };
        ctx.save();
        ctx.beginPath();
        tri.forEach((p, n) => { // expand ~0.8px to hide seams
          const v = sub(p, cen); const l = len(v) || 1; const q = add(p, mul(v, 0.8 / l));
          if (n === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        ctx.closePath(); ctx.clip();
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.drawImage(garment, 0, 0);
        ctx.restore();
      }
    }
  }
  return out;
}

// ---------- stage 4: compositing ----------
function composite(personCanvas, info, warped) {
  const { w, h, cat, lm } = info;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(personCanvas, 0, 0);

  // Lighting: modulate the garment by the customer photo's low-frequency luminance so it matches the scene.
  const shade = document.createElement('canvas'); shade.width = w; shade.height = h;
  const sh = shade.getContext('2d');
  sh.filter = `blur(${Math.round(w / 40)}px) grayscale(1) contrast(0.55) brightness(1.25)`;
  sh.drawImage(personCanvas, 0, 0);
  sh.filter = 'none';
  sh.globalCompositeOperation = 'destination-in';
  sh.drawImage(warped, 0, 0);

  ctx.save();
  ctx.shadowColor = 'rgba(40, 25, 15, 0.28)'; ctx.shadowBlur = Math.round(w / 60); ctx.shadowOffsetY = Math.round(w / 220);
  ctx.drawImage(warped, 0, 0);
  ctx.restore();
  ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(shade, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // Re-layer face, hair and hands on top of the garment.
  const keep = new Float32Array(w * h);
  const sw = len(sub(lm[LM.ls], lm[LM.rs]));
  const hands = [lm[LM.lw], lm[LM.rw], lm[LM.li], lm[LM.ri]].filter((p) => p && p.v > 0.5);
  const hr2 = (sw * 0.28) ** 2;
  const neckY = Math.min(lm[LM.ls].y, lm[LM.rs].y) - sw * 0.05;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x; const c = cat[i];
      if (c === CAT.face || (c === CAT.hair && y < neckY + sw * 0.6)) keep[i] = 1;
      else if (c === CAT.body) {
        if (y < neckY) keep[i] = 1;
        else for (const p of hands) if ((x - p.x) ** 2 + (y - p.y) ** 2 < hr2) { keep[i] = 1; break; }
      }
    }
  }
  const feather = boxBlur(keep, w, h, 2);
  const top = document.createElement('canvas'); top.width = w; top.height = h;
  const tctx = top.getContext('2d');
  const pd = personCanvas.getContext('2d').getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) pd.data[i * 4 + 3] = Math.round(feather[i] * 255);
  tctx.putImageData(pd, 0, 0);
  ctx.drawImage(top, 0, 0);
  return out;
}

// ---------- public API ----------
const garmentCache = new Map();
let personCache = { key: null, info: null };

export async function tryOnLocal({ personCanvas, personKey, product, garmentUrl, onStage = () => {} }) {
  onStage('Loading on-device AI models…');
  const engine = await loadEngine();

  onStage('Detecting your pose…');
  if (personCache.key !== personKey) personCache = { key: personKey, info: await analyze(engine, personCanvas) };
  const person = personCache.info;
  if (!person.lm) throw new Error('We could not find a person in your photo. Please use a clear, front-facing photo showing at least your head to hips.');
  const vis = [LM.ls, LM.rs, LM.lh, LM.rh].every((i) => person.lm[i].v > 0.3);
  if (!vis) throw new Error('Please use a photo where your shoulders and hips are visible, facing the camera.');

  onStage('Extracting the garment…');
  let garment = garmentCache.get(product.slug);
  if (!garment) {
    const gc = canvasFrom(await loadImage(garmentUrl), 1024);
    garment = extractGarment(gc, await analyze(engine, gc), product.garment);
    garmentCache.set(product.slug, garment);
  }

  onStage('Fitting the drape to your body…');
  await new Promise((r) => setTimeout(r, 30));
  const src = bodyRows(garment.lm);
  const dst = bodyRows(person.lm);
  const warped = warpGarment(garment.canvas, src, dst, person.w, person.h);

  onStage('Rendering your look…');
  return composite(personCanvas, person, warped).toDataURL('image/jpeg', 0.92);
}
