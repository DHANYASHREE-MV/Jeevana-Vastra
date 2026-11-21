// Shared mannequin prompt wording, used by scripts/mannequin.js (API) and scripts/make-mannequin-kit.js (Gemini app).
// Every item uses the SAME mannequin, pose and framing so the catalogue looks like one photoshoot.

const MANNEQUIN = 'a premium high-fashion boutique mannequin with a full, slender, elegant female figure and graceful proportions: '
  + 'smooth matte ivory finish, abstract faceless head with softly sculpted features and a sleek sculpted low bun, long graceful neck, '
  + 'natural sculpted arms with the right hand resting lightly on the hip and the left arm relaxed at the side, '
  + 'standing in a poised catwalk pose with the weight on one leg, on a slim round brushed-brass base';

const STYLE = {
  saree: `Drape the saree on ${MANNEQUIN}, in an elegant Nivi drape: crisp, evenly folded front pleats, a neat fitted blouse `
    + '(matching the blouse piece if one is shown, otherwise a plain blouse in a matching colour), and the pallu draped over the left shoulder '
    + 'and falling in front to about knee length so the full pallu design and border are clearly visible.',
  default: `Dress ${MANNEQUIN} in the complete outfit (kurta/top, bottom and dupatta if present, with the dupatta draped gracefully over one shoulder), `
    + 'with a tailored, flattering fit while keeping the natural garment shape and length.',
};

const FRAMING = 'Full length from head to base, centred, straight-on front view. The same mannequin, pose and framing in every image. '
  + 'Soft, even, luxurious studio lighting with gentle shadows that show the fabric drape; seamless warm ivory background (colour #F6F1E9) with a subtle soft floor shadow. '
  + 'Vertical 3:4 portrait image, editorial fashion-catalogue style.';

function mannequinPrompt(p) {
  const source = p.flatlay
    ? 'The photo shows the garment folded or laid flat.'
    : 'The photo shows the garment worn by a model or on a display form. Use ONLY the clothing; do not show that person.';
  return [
    `Create a professional luxury fashion-catalogue photo of the exact garment in the attached photo ("${p.name}", ${p.color}, ${p.fabric}).`,
    source, STYLE[p.garment === 'saree' ? 'saree' : 'default'], FRAMING,
    'AUTHENTICITY IS CRITICAL: reproduce the garment exactly as photographed: identical colours, print, motifs, embroidery, zari, border width and pattern, tassels and fabric texture.',
    'Do not invent, add, remove, simplify or restyle any design element. No jewellery, no props, no text, no logos, no watermark, no human model.',
  ].join(' ');
}

module.exports = { mannequinPrompt };
