// FASHN.ai virtual try-on API (dedicated VTON model; strongest on kurtas, kurtis and sets).
const { sleep } = require('../util');

const API = 'https://api.fashn.ai/v1';
const MODEL = process.env.FASHN_MODEL || 'tryon-v1.6';

module.exports = {
  id: 'fashn',
  label: `FASHN (${MODEL})`,
  available: () => !!process.env.FASHN_API_KEY,
  // Sarees are not a garment category FASHN is trained on; route those elsewhere when possible.
  supports: (product) => product.garment !== 'saree',
  async tryOn({ personImage, garmentImage, product }) {
    const headers = { Authorization: `Bearer ${process.env.FASHN_API_KEY}`, 'Content-Type': 'application/json' };
    const run = await fetch(`${API}/run`, {
      method: 'POST', headers,
      body: JSON.stringify({
        model_name: MODEL,
        inputs: {
          model_image: personImage,
          garment_image: garmentImage,
          category: product.garment === 'kurti' ? 'tops' : 'one-pieces',
          garment_photo_type: product.flatlay ? 'flat-lay' : 'model',
          mode: 'quality',
          return_base64: true,
        },
      }),
    });
    const started = await run.json().catch(() => ({}));
    if (!run.ok || !started.id) throw new Error(started.error?.message || started.error || `FASHN request failed (${run.status})`);
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await sleep(2500);
      const st = await (await fetch(`${API}/status/${started.id}`, { headers })).json();
      if (st.status === 'completed') {
        const out = st.output[0];
        return out.startsWith('data:') ? out : `data:image/png;base64,${out}`;
      }
      if (st.status === 'failed') throw new Error(st.error?.message || 'FASHN could not generate this look');
    }
    throw new Error('FASHN timed out');
  },
};
