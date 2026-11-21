// Virtual Try-On service: picks a cloud AI provider, keeps a short result cache.
//
// Provider order is TRYON_PROVIDERS (comma list) or the default below; the first one that is
// configured *and* supports the garment type wins, the rest are fallbacks if it errors.
// With no keys configured the client uses the in-browser engine (public/js/tryon/local-engine.js).
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('../db');
const { toProduct, BASE } = require('../routes/catalog');
const { rateLimit } = require('../auth');
const { dataUriParts } = require('./util');

const PROVIDERS = { gemini: require('./providers/gemini'), fashn: require('./providers/fashn'), replicate: require('./providers/replicate') };
const ORDER = (process.env.TRYON_PROVIDERS || 'gemini,fashn,replicate').split(',').map((s) => s.trim()).filter((s) => PROVIDERS[s]);
const IMG_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'products');

const router = express.Router();
const cache = new Map(); // key -> data URI (small LRU)
const MAX_CACHE = 40;

function chain(product) {
  return ORDER.map((id) => PROVIDERS[id]).filter((p) => p.available() && p.supports(product));
}

// The exact catalogue garment used for try-on: the untouched original product photo.
function garmentImageFor(product) {
  const name = product.tryonImage;
  const file = path.join(IMG_DIR, `${name}.jpg`);
  return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
}

router.get('/config', (req, res) => {
  const configured = ORDER.filter((id) => PROVIDERS[id].available());
  res.json({
    cloud: configured.length > 0,
    providers: configured.map((id) => ({ id, label: PROVIDERS[id].label })),
    // garments each configured provider chain can handle (sarees need Gemini)
    sareeSupported: configured.some((id) => PROVIDERS[id].supports({ garment: 'saree' })),
    local: true,
  });
});

router.post('/', rateLimit('tryon', 30, 10 * 60 * 1000), async (req, res) => {
  const { productSlug, personImage, imageIndex = 0 } = req.body || {};
  const product = toProduct(db.prepare(`${BASE} WHERE p.slug = ?`).get(productSlug));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  try {
    const { mime, b64 } = dataUriParts(personImage);
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error('Please upload a JPG, PNG or WebP photo');
    if (b64.length > 11_000_000) throw new Error('Photo is too large — please use one under 8 MB');
  } catch (e) { return res.status(400).json({ error: e.message }); }

  const providers = chain(product);
  if (!providers.length) {
    return res.status(503).json({ error: 'Cloud AI try-on is not configured for this garment.', code: 'NO_PROVIDER' });
  }
  const key = crypto.createHash('sha256').update(personImage).update(`|${product.slug}|${imageIndex}`).digest('hex');
  if (cache.has(key)) return res.json({ image: cache.get(key), provider: 'cache', cached: true });

  const garmentImage = garmentImageFor(product);
  const errors = [];
  for (const p of providers) {
    try {
      const started = Date.now();
      const image = await p.tryOn({ personImage, garmentImage, product });
      cache.set(key, image);
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
      // Customer photos are processed in memory only — nothing is written to disk.
      return res.json({ image, provider: p.label, ms: Date.now() - started });
    } catch (e) {
      console.warn(`[tryon] ${p.id} failed:`, e.message);
      errors.push(`${p.label}: ${e.message}`);
    }
  }
  res.status(502).json({ error: 'The AI studio could not create this look right now. Please try another photo or garment.', details: errors });
});

module.exports = { router, garmentImageFor, PROVIDERS };
