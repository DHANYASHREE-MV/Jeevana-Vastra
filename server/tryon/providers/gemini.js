// Google Gemini image model ("Nano Banana" family) — multimodal image editing.
// Best general choice for Indian ethnic wear: it can drape sarees and dupattas, which
// classic VTON models (trained on western tops/dresses) cannot.
const { dataUriParts } = require('../util');

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

async function generate(parts, { timeoutMs = 120000 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `Gemini request failed (${res.status})`);
  const out = json.candidates?.[0]?.content?.parts || [];
  const img = out.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const text = out.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(text ? `The AI model declined: ${text.slice(0, 200)}` : 'The AI model returned no image');
  }
  const d = img.inlineData || img.inline_data;
  return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
}

const img = (uri) => { const { mime, b64 } = dataUriParts(uri); return { inline_data: { mime_type: mime, data: b64 } }; };

module.exports = {
  id: 'gemini',
  label: `Google Gemini (${MODEL})`,
  available: () => !!process.env.GEMINI_API_KEY,
  supports: () => true,
  generate,
  img,
  async tryOn({ personImage, garmentImage, product }) {
    const drape = product.garment === 'saree'
      ? 'Drape the saree on the person in a classic Nivi style with the pallu over the left shoulder, pleats at the front, and a matching blouse.'
      : `Dress the person in the complete ${product.garment === 'coord' ? 'co-ord set (top and pants)' : 'outfit (kurta/top, bottom and dupatta if present)'}.`;
    const prompt = [
      'Virtual try-on for an ethnic fashion store.',
      'IMAGE 1 is the customer. IMAGE 2 shows the garment for sale',
      product.flatlay ? '(photographed flat / folded).' : '(it may be worn by a model or mannequin — use ONLY the clothing, never that person).',
      `Garment: "${product.name}" — ${product.color}, ${product.fabric}.`,
      drape,
      'Hard rules: keep the customer\'s face, identity, skin tone, hair, body shape, pose, hands and background exactly as in IMAGE 1.',
      'Reproduce the garment faithfully: identical colours, print, embroidery, border, zari and fabric texture — do not invent or simplify the design.',
      'Natural fit, realistic folds, consistent lighting. Return one photorealistic image at the same framing as IMAGE 1.',
    ].join(' ');
    return generate([{ text: prompt }, img(personImage), img(garmentImage)]);
  },
};
