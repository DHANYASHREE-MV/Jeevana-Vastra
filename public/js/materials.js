// Fabric / material families, used by the AI Atelier (home) and the Try-On studio material picker.
// Each product can belong to several families; matching uses its fabric, name and description.
import { img } from './ui.js';

export const MATERIALS = [
  { key: 'silk', label: 'Silk', note: 'Lustrous, rich drape', re: /silk/ },
  { key: 'zari', label: 'Zari & Brocade', note: 'Woven gold motifs', re: /zari|brocade|banarasi|jaal/ },
  { key: 'kalamkari', label: 'Kalamkari', note: 'Hand-painted stories', re: /kalamkari/ },
  { key: 'organza', label: 'Organza', note: 'Sheer, airy glow', re: /organza|tissue/ },
  { key: 'georgette', label: 'Georgette', note: 'Fluid and flowing', re: /georgette/ },
  { key: 'chanderi', label: 'Chanderi', note: 'Featherlight sheen', re: /chanderi/ },
  { key: 'cotton', label: 'Cotton & Muslin', note: 'Breathable everyday', re: /cotton|muslin/ },
  { key: 'linen', label: 'Linen & Modal', note: 'Soft, relaxed fit', re: /linen|modal|rayon/ },
];

const hay = (p) => `${p.fabric} ${p.name} ${p.description}`.toLowerCase();
export const matches = (p, key) => (key === 'all' ? true : MATERIALS.find((m) => m.key === key)?.re.test(hay(p)));

// Materials present in the catalogue, each with a fabric swatch cut from a real product photo.
export function materialsFor(products) {
  return MATERIALS.map((m) => {
    const list = products.filter((p) => m.re.test(hay(p)));
    const sw = list.find((p) => p.images[0].endsWith('-mq')) || list[0];
    return { ...m, count: list.length, swatch: sw ? img(sw.images[0]) : null };
  }).filter((m) => m.count > 0);
}

// CSS for a round fabric swatch: zoom into the drape of the mannequin photo.
export const swatchStyle = (m) => (m.swatch ? `background-image:url('${m.swatch}')` : '');
