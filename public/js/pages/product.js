import { catalog } from '../api.js';
import { cart, wishlist } from '../store.js';
import { $, $$, esc, inr, img, icons, priceHtml, productCard, setMeta, toast, COLOR_HEX, absUrl } from '../ui.js';

const CARE = {
  saree: 'Dry clean recommended for the first wash. Store folded in a muslin cloth; refold along different lines every few months to protect the zari.',
  default: 'Gentle hand wash in cold water or dry clean. Wash dark colours separately. Iron on reverse at low heat; do not iron directly on embroidery.',
};

export async function render({ el, params }) {
  const { product: p, related } = await catalog.product(params.slug);
  setMeta(p.name, p.description);
  let active = 0;
  let size = p.sizes.length === 1 ? p.sizes[0] : null;
  let qty = 1;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description,
    image: p.images.map((i) => absUrl(img(i, 1080))), color: p.color, material: p.fabric, category: p.categoryName,
    brand: { '@type': 'Brand', name: 'Jeevana Vastra' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews },
    offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.price, availability: `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`, url: location.href },
  };

  el.innerHTML = `
  <div class="container">
    <div class="page-head" style="padding-bottom:20px">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="./">Home</a><span>/</span><a href="shop/${p.category}">${esc(p.categoryName)}</a><span>/</span><span>${esc(p.name)}</span></nav>
    </div>
    <div class="pdp">
      <div class="gallery ${p.images.length > 1 ? '' : 'single'}">
        ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((im, i) => `<button class="${i === 0 ? 'on' : ''}" data-thumb="${i}" aria-label="View image ${i + 1}"><img src="${img(im)}" alt=""></button>`).join('')}</div>` : ''}
        <div class="main-img" id="mainImg">
          <img src="${img(p.images[0], 1080)}" alt="${esc(p.name)} in ${esc(p.color)}" id="mainPic" width="900" height="1200">
          <span class="view-note">${p.images[0].endsWith('-mq') ? 'Mannequin presentation' : 'Original product photo · hover to zoom'}</span>
        </div>
      </div>
      <div class="pdp-info">
        <a class="card-cat" href="shop/${p.category}">${esc(p.categoryName)}</a>
        <h1>${esc(p.name)}</h1>
        <div class="rating"><b>${p.rating} ★</b> ${p.reviews} verified reviews</div>
        <div class="pdp-price">${priceHtml(p)}</div>
        <div class="tax-note">Inclusive of all taxes · Free shipping above ₹1,499</div>

        <div class="opt-label">Colour <span>${esc(p.color)}</span></div>
        <div class="color-row"><span class="swatch on" style="background:${COLOR_HEX[p.color] || '#ccc'}" aria-hidden="true"></span> <a class="link-btn" href="shop?colors=${encodeURIComponent(p.color)}">More in ${esc(p.color)}</a></div>

        <div class="opt-label">Size <span>${p.garment === 'saree' ? 'Saree 5.5 m + 0.8 m unstitched blouse piece' : '<button class="link-btn" id="sizeGuide">Size guide</button>'}</span></div>
        <div class="size-chips">${p.sizes.map((s) => `<button class="chip ${size === s ? 'on' : ''}" data-size="${s}" ${p.stock[s] ? '' : 'disabled title="Sold out"'}>${s}</button>`).join('')}</div>
        <div class="stock-note" id="note">${!p.inStock ? 'This style is currently sold out.' : ''}</div>

        <div class="buy-row">
          <div class="qty"><button data-q="-1" aria-label="Decrease quantity">−</button><input id="qty" type="number" value="1" min="1" max="10" aria-label="Quantity"><button data-q="1" aria-label="Increase quantity">+</button></div>
          <button class="btn" id="addBtn" ${p.inStock ? '' : 'disabled'}>${icons.bag} ${p.inStock ? 'Add to bag' : 'Sold out'}</button>
          <button class="wish-square ${wishlist.has(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-label="Save to wishlist">${icons.heart}</button>
        </div>
        <a class="tryon-cta" href="virtual-try-on?product=${p.slug}">
          <span class="ic">${icons.spark}</span>
          <span><b>Try it on virtually</b><small>Upload a photo and see this ${p.garment === 'saree' ? 'saree' : 'outfit'} on you, powered by AI</small></span>
        </a>

        <div class="perks"><div><b>7-day</b>easy exchange</div><div><b>COD</b>available</div><div><b>Handpicked</b>quality checked</div></div>

        <div class="accordion">
          <details open><summary>Description</summary><div class="acc-body">${esc(p.description)}</div></details>
          <details><summary>Product details</summary><div class="acc-body"><dl>
            <dt>Fabric</dt><dd>${esc(p.fabric)}</dd><dt>Colour</dt><dd>${esc(p.color)}</dd><dt>Category</dt><dd>${esc(p.categoryName)}</dd>
            <dt>Includes</dt><dd>${p.garment === 'saree' ? 'Saree with blouse piece' : p.garment === 'kurti' ? 'Kurti' : p.garment === 'coord' ? 'Top and pants' : 'Kurta, bottom and dupatta'}</dd>
            <dt>Style code</dt><dd>JV-${String(p.id).padStart(4, '0')}</dd></dl></div></details>
          <details><summary>Fabric &amp; care</summary><div class="acc-body">${CARE[p.garment] || CARE.default}</div></details>
          <details><summary>Shipping &amp; returns</summary><div class="acc-body">Dispatched within 24–48 hours; delivered in 3–6 business days across India. Free shipping on orders above ₹1,499. Easy 7-day exchange on unused items with original tags.</div></details>
        </div>
      </div>
    </div>

    ${related.length ? `<section class="section" style="padding-top:20px">
      <div class="section-head"><div><span class="eyebrow">Complete the look</span><h2>You may also like</h2></div></div>
      <div class="grid cols-4">${related.slice(0, 4).map(productCard).join('')}</div>
    </section>` : ''}
  </div>
  <div class="sticky-buy"><a class="btn btn-outline" href="virtual-try-on?product=${p.slug}">${icons.spark} Try on</a><button class="btn" id="stickyAdd" ${p.inStock ? '' : 'disabled'}>Add to bag</button></div>`;

  const ld = document.createElement('script');
  ld.type = 'application/ld+json'; ld.textContent = JSON.stringify(jsonLd);
  el.append(ld);

  // Gallery + zoom
  const main = $('#mainImg', el); const pic = $('#mainPic', el);
  $$('[data-thumb]', el).forEach((b) => b.addEventListener('click', () => {
    active = Number(b.dataset.thumb);
    pic.src = img(p.images[active], 1080);
    $('.view-note', el).textContent = p.images[active].endsWith('-mq') ? 'Mannequin presentation' : 'Original product photo · hover to zoom';
    $$('[data-thumb]', el).forEach((x) => x.classList.toggle('on', x === b));
  }));
  main.addEventListener('mousemove', (e) => {
    const r = main.getBoundingClientRect();
    pic.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  });
  main.addEventListener('mouseenter', () => main.classList.add('zoom'));
  main.addEventListener('mouseleave', () => main.classList.remove('zoom'));

  // Size & qty
  const note = $('#note', el);
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-size]');
    if (chip) {
      size = chip.dataset.size;
      $$('[data-size]', el).forEach((c) => c.classList.toggle('on', c === chip));
      const left = p.stock[size];
      note.textContent = left <= 3 ? `Hurry — only ${left} left in ${size}` : '';
      note.style.color = '';
    }
    const q = e.target.closest('[data-q]');
    if (q) { qty = Math.max(1, Math.min(10, qty + Number(q.dataset.q))); $('#qty', el).value = qty; }
    if (e.target.closest('#sizeGuide')) {
      import('../ui.js').then(({ openModal }) => openModal(`<div style="padding:30px"><h2 style="font-size:32px;margin-bottom:14px">Size guide (inches)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${[['Size', 'Bust', 'Waist', 'Hip'], ['XS', 32, 26, 35], ['S', 34, 28, 37], ['M', 36, 30, 39], ['L', 38, 32, 41], ['XL', 40, 34, 43], ['XXL', 42, 36, 45], ['3XL', 44, 38, 47]]
        .map((r, i) => `<tr>${r.map((c) => `<${i ? 'td' : 'th'} style="padding:9px;border-bottom:1px solid var(--line);text-align:left">${c}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>
        <p style="margin-top:14px;color:var(--muted);font-size:13px">Garment measurements. If you are between sizes, pick the larger one for a relaxed fit.</p></div>`, { narrow: true }));
    }
  });
  $('#qty', el).addEventListener('change', (e) => { qty = Math.max(1, Math.min(10, Number(e.target.value) || 1)); e.target.value = qty; });

  const add = async (btn) => {
    if (!size) { note.textContent = 'Please select a size'; note.style.color = 'var(--danger)'; $('.size-chips', el).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    btn.classList.add('is-loading');
    try {
      await cart.add(p.id, size, qty);
      toast(`Added to bag · ${esc(p.name)} (${size})`, { image: img(p.images[0]), link: { href: '/bag', label: 'View bag' } });
    } catch (err) { toast(esc(err.message), { type: 'error' }); } finally { btn.classList.remove('is-loading'); }
  };
  $('#addBtn', el).addEventListener('click', (e) => add(e.currentTarget));
  $('#stickyAdd', el).addEventListener('click', (e) => add(e.currentTarget));

  // Recently viewed (per-browser convenience)
  try {
    const rv = JSON.parse(localStorage.getItem('jv_recent') || '[]').filter((s) => s !== p.slug);
    localStorage.setItem('jv_recent', JSON.stringify([p.slug, ...rv].slice(0, 12)));
  } catch { /* storage unavailable */ }
}
