// Shared UI building blocks: escaping, formatting, product cards, quick view, modal, toasts.
import { state, cart, wishlist } from './store.js';
import { catalog } from './api.js';
import { flyToBag } from './effects.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export const img = (base, size = 480) => `img/products/${base}-${size}.webp`;

// The site can live at "/" (Node server) or under a sub-path (GitHub Pages). <base href> holds that prefix.
export const BASE = new URL(document.baseURI).pathname;
export const toUrl = (u) => (u.startsWith(BASE) ? u : BASE + u.replace(/^\//, ''));
export const appPath = () => `/${location.pathname.slice(BASE.length)}`;
export const absUrl = (u) => new URL(u, document.baseURI).href;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const COLOR_HEX = {
  Blue: '#1F4E9C', Pink: '#D63A78', Brown: '#7A4A2A', Green: '#1F6B45', Orange: '#E58A2B', Maroon: '#6E1E2B', Ivory: '#F3ECDD',
  Teal: '#0F7C83', Copper: '#B4643A', Red: '#C0262D', Black: '#1B1B1B', Purple: '#6B4A7A', Peach: '#F2A98E', Mint: '#9ED9C7',
  White: '#FFFFFF', Turquoise: '#1BB3C0', Lavender: '#B9A6DA', Cream: '#F4E7C8', Rust: '#B5512B',
  Mustard: '#C9962B', Grey: '#A9A7A4', Magenta: '#9E1F63', Rose: '#C98585',
};

export const icons = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9-9.2C1.7 7.6 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.3 3.1 4 6.3-2 4.8-9 9.2-9 9.2Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v4h16v-4"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 20h16"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
};

export function priceHtml(p) {
  return `<div class="price"><b>${inr(p.price)}</b>${p.mrp > p.price ? `<s>${inr(p.mrp)}</s><span class="off">${p.discount}% off</span>` : ''}</div>`;
}

export function productCard(p) {
  const tags = [];
  if (!p.inStock) tags.push('<span class="tag sold">Sold out</span>');
  else if (p.tags.includes('new')) tags.push('<span class="tag new">New</span>');
  if (p.tags.includes('bestseller')) tags.push('<span class="tag best">Bestseller</span>');
  const on = wishlist.has(p.id);
  return `<article class="card" data-id="${p.id}">
    <div class="card-media">
      <a href="product/${p.slug}" aria-label="${esc(p.name)}">
        <img src="${img(p.images[0])}" alt="${esc(p.name)} — ${esc(p.color)} ${esc(p.categoryName)}" loading="lazy" width="480" height="640">
        ${p.images[1] ? `<img class="alt" src="${img(p.images[1])}" alt="" loading="lazy" width="480" height="640">` : ''}
      </a>
      <div class="card-tags">${tags.join('')}</div>
      <button class="wish-btn ${on ? 'on' : ''}" data-wish="${p.id}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} wishlist">${icons.heart}</button>
      <div class="card-actions">
        <button data-quickview="${p.slug}">${icons.eye}<span class="qv-label">Quick view</span></button>
        <button data-tryon="${p.slug}">${icons.spark}<span class="qv-label">Try on</span></button>
      </div>
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(p.categoryName)} · <i class="swatch-dot" style="background:${COLOR_HEX[p.color] || '#ccc'}"></i> ${esc(p.color)}</span>
      <h3 class="card-name"><a href="product/${p.slug}">${esc(p.name)}</a></h3>
      ${priceHtml(p)}
    </div>
  </article>`;
}

export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => '<div><div class="skeleton" style="aspect-ratio:3/4"></div><div class="skeleton" style="height:14px;margin-top:12px;width:60%"></div><div class="skeleton" style="height:18px;margin-top:8px;width:85%"></div></div>').join('');
}

// ---------- Toasts ----------
export function toast(message, { type = 'info', image, link } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${image ? `<img src="${image}" alt="">` : ''}<span>${message}</span>${link ? `<a href="${toUrl(link.href)}">${esc(link.label)}</a>` : ''}`;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3800);
}

// ---------- Modal ----------
let lastFocus = null;
export function openModal(html, { narrow = false, onOpen } = {}) {
  const modal = $('#modal');
  const card = $('.modal-card', modal);
  lastFocus = document.activeElement;
  card.className = `modal-card${narrow ? ' narrow' : ''}`;
  card.innerHTML = `<button class="icon-btn modal-close" data-close aria-label="Close">${icons.close}</button>${html}`;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  onOpen?.(card);
  card.querySelector('button, a, input')?.focus();
  return card;
}
export function closeModal() {
  $('#modal').hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus?.();
}

// ---------- Quick view ----------
export async function quickView(slug) {
  const card = openModal('<div class="page-loading"><div class="skeleton" style="width:60px;height:60px;border-radius:50%"></div></div>');
  const { product: p } = await catalog.product(slug);
  let size = p.sizes.length === 1 ? p.sizes[0] : null;
  card.innerHTML = `<button class="icon-btn modal-close" data-close aria-label="Close">${icons.close}</button>
    <div class="qv">
      <div class="qv-media"><img src="${img(p.images[0], 1080)}" alt="${esc(p.name)}"></div>
      <div class="qv-info">
        <span class="card-cat">${esc(p.categoryName)}</span>
        <h2>${esc(p.name)}</h2>
        <div class="rating"><b>${p.rating} ★</b> ${p.reviews} reviews</div>
        <div class="pdp-price" style="font-size:22px">${priceHtml(p)}</div>
        <div class="opt-label">Size <span>${p.garment === 'saree' ? 'Includes unstitched blouse piece' : ''}</span></div>
        <div class="size-chips">${p.sizes.map((s) => `<button class="chip ${size === s ? 'on' : ''}" data-size="${s}" ${p.stock[s] ? '' : 'disabled'}>${s}</button>`).join('')}</div>
        <div class="stock-note" id="qvNote"></div>
        <div class="side-actions">
          <button class="btn" id="qvAdd" ${p.inStock ? '' : 'disabled'}>${icons.bag} ${p.inStock ? 'Add to bag' : 'Sold out'}</button>
          <a class="btn btn-outline" href="virtual-try-on?product=${p.slug}" data-close>${icons.spark} Try it on virtually</a>
        </div>
        <p class="desc">${esc(p.description)}</p>
        <a class="link" href="product/${p.slug}" data-close>View full details</a>
      </div>
    </div>`;
  card.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-size]');
    if (chip) {
      size = chip.dataset.size;
      $$('[data-size]', card).forEach((c) => c.classList.toggle('on', c === chip));
      const left = p.stock[size];
      $('#qvNote', card).textContent = left && left <= 3 ? `Only ${left} left in ${size}` : '';
    }
    if (e.target.closest('#qvAdd')) {
      if (!size) { $('#qvNote', card).textContent = 'Please select a size'; return; }
      const btn = e.target.closest('#qvAdd');
      btn.classList.add('is-loading');
      try {
        await cart.add(p.id, size, 1);
        flyToBag(card.querySelector('.qv-media img'));
        closeModal();
        toast(`Added to bag · ${esc(p.name)}`, { image: img(p.images[0]), link: { href: '/bag', label: 'View bag' } });
      } catch (err) { $('#qvNote', card).textContent = err.message; } finally { btn.classList.remove('is-loading'); }
    }
  });
}

// Delegated handlers for wishlist / quick view / try-on buttons on any card.
export function bindCardActions(root, navigate) {
  root.addEventListener('click', async (e) => {
    const w = e.target.closest('[data-wish]');
    if (w) {
      e.preventDefault();
      const id = Number(w.dataset.wish);
      const saved = await wishlist.toggle(id);
      $$(`[data-wish="${id}"]`).forEach((b) => { b.classList.toggle('on', saved); b.setAttribute('aria-pressed', saved); });
      toast(saved ? 'Saved to your wishlist' : 'Removed from wishlist', { link: saved ? { href: '/wishlist', label: 'View' } : null });
      return;
    }
    const q = e.target.closest('[data-quickview]');
    if (q) { e.preventDefault(); quickView(q.dataset.quickview); return; }
    const t = e.target.closest('[data-tryon]');
    if (t) { e.preventDefault(); navigate(`/virtual-try-on?product=${t.dataset.tryon}`); }
  });
}

export function setMeta(title, description) {
  document.title = title ? `${title} | Jeevana Vastra` : 'Jeevana Vastra — Premium Indian Ethnic Wear';
  if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

export function observeReveal(root = document) {
  if (!('IntersectionObserver' in window)) { $$('.reveal', root).forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -60px 0px' });
  $$('.reveal', root).forEach((el) => io.observe(el));
}

export const requireLoginHtml = (next, msg = 'Sign in to continue') => `<div class="empty"><h2>${esc(msg)}</h2><p>Your bag and wishlist are saved and will be waiting for you.</p><a class="btn" href="account?next=${encodeURIComponent(next)}">Sign in or create account</a></div>`;
export { state };
