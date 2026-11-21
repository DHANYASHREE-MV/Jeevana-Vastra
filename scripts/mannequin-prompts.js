// Shared mannequin prompt wording, used by scripts/mannequin.js (API) and scripts/make-mannequin-kit.js (Gemini app).
const POSE = 'Front view, full length from neckline to hem, centred, the same standard upright mannequin pose for every item. Soft even studio lighting, seamless warm ivory background (colour #F6F1E9), subtle soft floor shadow. Vertical 3:4 portrait image.';

const STYLE = {
  saree: 'Drape it on a realistic matte ivory headless 3D dress-form mannequin in a classic Nivi drape: neat pleats at the front, pallu over the left shoulder falling to the knee so the pallu design and border are clearly visible, with a plain blouse matching the blouse piece if one is shown.',
  default: 'Dress a realistic matte ivory headless 3D dress-form mannequin in the complete outfit (kurta/top, bottom and dupatta if present), keeping the natural garment shape and length.',
};

function mannequinPrompt(p) {
  const source = p.flatlay
    ? 'The photo shows the garment folded or laid flat.'
    : 'The photo shows the garment worn by a model or on a display form. Use ONLY the clothing; do not show the person.';
  return [
    `Create a professional e-commerce catalogue photo of the exact garment in the attached photo ("${p.name}", ${p.color}, ${p.fabric}).`,
    source, STYLE[p.garment === 'saree' ? 'saree' : 'default'], POSE,
    'AUTHENTICITY IS CRITICAL: reproduce the garment exactly as photographed: identical colours, print, motifs, embroidery, zari, border width and pattern, tassels and fabric texture.',
    'Do not invent, add, remove, simplify or restyle any design element. No props, no text, no logos, no watermark, no human model.',
  ].join(' ');
}

module.exports = { mannequinPrompt };
