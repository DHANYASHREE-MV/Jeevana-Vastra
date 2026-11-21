// Replicate-hosted IDM-VTON (open-source diffusion try-on model).
const { sleep, urlToDataUri } = require('../util');

const API = 'https://api.replicate.com/v1';
const MODEL = process.env.REPLICATE_TRYON_MODEL || 'cuuupid/idm-vton';
let cachedVersion = null;

module.exports = {
  id: 'replicate',
  label: `Replicate (${MODEL})`,
  available: () => !!process.env.REPLICATE_API_TOKEN,
  supports: (product) => product.garment !== 'saree',
  async tryOn({ personImage, garmentImage, product }) {
    const headers = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' };
    if (!cachedVersion) {
      const m = await (await fetch(`${API}/models/${MODEL}`, { headers })).json();
      cachedVersion = m.latest_version?.id;
      if (!cachedVersion) throw new Error('Could not resolve the Replicate model version');
    }
    const res = await fetch(`${API}/predictions`, {
      method: 'POST', headers: { ...headers, Prefer: 'wait=60' },
      body: JSON.stringify({
        version: cachedVersion,
        input: {
          human_img: personImage, garm_img: garmentImage,
          garment_des: `${product.color} ${product.name}, ${product.fabric}`,
          category: product.garment === 'kurti' ? 'upper_body' : 'dresses',
          crop: false, steps: 30,
        },
      }),
    });
    let pred = await res.json();
    if (!res.ok) throw new Error(pred.detail || `Replicate request failed (${res.status})`);
    const deadline = Date.now() + 150000;
    while (!['succeeded', 'failed', 'canceled'].includes(pred.status) && Date.now() < deadline) {
      await sleep(2500);
      pred = await (await fetch(pred.urls.get, { headers })).json();
    }
    if (pred.status !== 'succeeded') throw new Error(pred.error || 'Replicate could not generate this look');
    return urlToDataUri(Array.isArray(pred.output) ? pred.output[0] : pred.output);
  },
};
