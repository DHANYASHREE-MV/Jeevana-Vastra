// App shell: client-side router, header, search, drawer and global listeners.
import * as store from './store.js';
import { initEffects } from './effects.js';
import { catalog } from './api.js';
import { $, $$, esc, inr, img, closeModal, toast, bindCardActions, BASE, toUrl, appPath } from './ui.js';

const routes = [
  [/^\/$/, 'home'],
  [/^\/shop\/?$/, 'shop'],
  [/^\/shop\/([a-z0-9-]+)\/?$/, 'shop', ['category']],
  [/^\/product\/([a-z0-9-]+)\/?$/, 'product', ['slug']],
  [/^\/virtual-try-on\/?$/, 'tryon'],
  [/^\/bag\/?$/, 'bag'],
  [/^\/wishlist\/?$/, 'wishlist'],
  [/^\/contact\/?$/, 'contact'],
  [/^\/(privacy|terms)\/?$/, 'legal', ['doc']],
  [/^\/checkout\/?$/, 'checkout'],
  [/^\/account\/?$/, 'account', [], { tab: 'profile' }],
  [/^\/account\/(orders|addresses|wishlist|profile)\/?$/, 'account', ['tab']],
  [/^\/account\/orders\/([A-Z0-9]+)\/?$/, 'order', ['number']],
];

const app = $('#app');
let cleanup = null;
let renderId = 0;

export function navigate(url, { replace = false, keepScroll = false } = {}) {
  const full = toUrl(url);
  if (replace) history.replaceState({ keepScroll }, '', full); else history.pushState({ keepScroll }, '', full);
  render();
}

async function render() {
  const id = ++renderId;
  const path = appPath();
  const query = Object.fromEntries(new URLSearchParams(location.search));
  let page = 'notfound'; let params = {};
  for (const [re, name, keys = [], defaults = {}] of routes) {
    const m = re.exec(path);
    if (m) { page = name; params = { ...defaults }; keys.forEach((k, i) => { params[k] = m[i + 1]; }); break; }
  }
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  closeModal();
  closeDrawer();
  $$('.main-nav a').forEach((a) => { const h = `/${a.getAttribute('href')}`; a.classList.toggle('active', h === path + location.search || (path !== '/' && h === path)); });
  try {
    const mod = await import(`./pages/${page}.js`);
    if (id !== renderId) return;
    app.innerHTML = '';
    cleanup = await mod.render({ el: app, params, query, navigate });
    if (!history.state?.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    console.error(err);
    if (id === renderId) app.innerHTML = `<div class="container empty"><h2>Something went wrong</h2><p>${esc(err.message)}</p><a class="btn" href="./">Back to home</a></div>`;
  }
}

// ---------- Link interception ----------
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') && !$('#modal').hidden) closeModal();
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || url.pathname.startsWith('/api') || /\.(\w{2,4})$/.test(url.pathname)) return;
  e.preventDefault();
  navigate(url.pathname + url.search);
});
window.addEventListener('popstate', render);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); closeSearch(); closeDrawer(); }
});
bindCardActions(document.body, navigate);

// ---------- Header ----------
const header = $('#siteHeader');
window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 8), { passive: true });

function updateBadges(what) {
  if (what === 'cart' || what === 'all') setBadge('cart', store.state.cart.count);
  if (what === 'wishlist' || what === 'all' || what === 'user') setBadge('wishlist', store.state.wishlist.size);
}
function setBadge(key, n) {
  const el = $(`[data-count="${key}"]`);
  const prev = Number(el.textContent);
  el.textContent = n; el.hidden = !n;
  if (n > prev) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
store.subscribe(updateBadges);

// ---------- Drawer ----------
const drawer = $('#mobileNav');
function openDrawer() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); $('#menuBtn').setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { if (!drawer.classList.contains('open')) return; drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); $('#menuBtn').setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
$('#menuBtn').addEventListener('click', openDrawer);
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });

// ---------- Search ----------
const overlay = $('#searchOverlay');
const input = $('#searchInput');
const results = $('#searchResults');
let searchTimer;
function openSearch() { overlay.hidden = false; input.value = ''; results.innerHTML = ''; setTimeout(() => input.focus(), 30); }
function closeSearch() { overlay.hidden = true; }
$('#searchBtn').addEventListener('click', openSearch);
$('#searchClose').addEventListener('click', closeSearch);
overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('a')) closeSearch(); });
input.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = input.value.trim();
  if (!q) { results.innerHTML = ''; return; }
  searchTimer = setTimeout(async () => {
    const hits = await catalog.suggest(q);
    if (input.value.trim() !== q) return;
    results.innerHTML = hits.length
      ? hits.map((h) => `<a href="product/${h.slug}"><img src="${img(h.image)}" alt=""><span>${esc(h.name)}<small>${esc(h.category)} · ${inr(h.price)}</small></span></a>`).join('')
        + `<a href="shop?q=${encodeURIComponent(q)}"><span>See all results for “${esc(q)}” →</span></a>`
      : `<p style="color:var(--muted)">No matches for “${esc(q)}”. Try “silk”, “peach” or “kurta”.</p>`;
  }, 160);
});
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  closeSearch();
  navigate(`/shop?q=${encodeURIComponent(q)}`);
});

// ---------- Footer ----------
$('#year').textContent = new Date().getFullYear();
$('#newsletter').addEventListener('submit', (e) => { e.preventDefault(); e.target.reset(); toast('Thank you — you are on the list for early access.'); });

// ---------- Boot ----------
initEffects();
store.init().catch((e) => console.error('state init failed', e)).finally(render);
