// Product listing: category, search, filters (price/colour/size/availability) and sorting.
// All filter state lives in the URL so results are shareable and back/forward works.
import { catalog } from '../api.js';
import { $, $$, esc, inr, productCard, skeletonCards, setMeta, COLOR_HEX } from '../ui.js';

const TAG_TITLES = { new: 'New Arrivals', bestseller: 'Bestsellers', trending: 'Trending Now' };
const SORTS = [['popular', 'Popularity'], ['newest', 'Newest first'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['discount', 'Biggest discount']];

export async function render({ el, params, query, navigate }) {
  const category = params.category || query.category || '';
  const cats = await catalog.categories();
  const cat = cats.find((c) => c.slug === category);
  const title = query.q ? `Results for “${query.q}”` : cat ? cat.name : TAG_TITLES[query.tag] || 'All Collections';
  setMeta(query.q ? `Search: ${query.q}` : title, cat ? `${cat.name} — ${cat.blurb}. Shop at Jeevana Vastra.` : undefined);

  const selected = {
    colors: new Set((query.colors || '').split(',').filter(Boolean)),
    sizes: new Set((query.sizes || '').split(',').filter(Boolean)),
  };

  el.innerHTML = `
  <div class="container">
    <div class="page-head">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="./">Home</a><span>/</span><a href="shop">Shop</a>${cat ? `<span>/</span><span>${esc(cat.name)}</span>` : ''}</nav>
      <h1>${esc(title)}</h1>
      ${cat ? `<p>${esc(cat.blurb)}</p>` : ''}
    </div>
    <div class="shop-layout">
      <aside class="filters" id="filters" aria-label="Filters">
        <div class="filters-head"><h3>Filters</h3><button class="icon-btn" data-close-filters aria-label="Close filters"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <details class="filter-group" open><summary>Category</summary>
          <div class="filter-body cat-links">
            <a href="shop${keep(query, ['q', 'tag'])}" class="${!category ? 'active' : ''}">All <small></small></a>
            ${cats.map((c) => `<a href="shop/${c.slug}${keep(query, ['q', 'tag'])}" class="${c.slug === category ? 'active' : ''}">${esc(c.name)} <small>${c.count}</small></a>`).join('')}
          </div>
        </details>
        <details class="filter-group" open><summary>Price</summary>
          <div class="filter-body">
            <div class="price-inputs">
              <input class="input" type="number" id="fMin" placeholder="Min" min="0" value="${esc(query.min || '')}" aria-label="Minimum price">
              <span>–</span>
              <input class="input" type="number" id="fMax" placeholder="Max" min="0" value="${esc(query.max || '')}" aria-label="Maximum price">
            </div>
            <div class="size-chips" id="priceQuick">
              <button class="chip" data-range="0-999">Under ₹1,000</button>
              <button class="chip" data-range="1000-1999">₹1,000–1,999</button>
              <button class="chip" data-range="2000-">₹2,000+</button>
            </div>
          </div>
        </details>
        <details class="filter-group" open><summary>Colour</summary><div class="filter-body"><div class="swatches" id="fColors"></div></div></details>
        <details class="filter-group" open><summary>Size</summary><div class="filter-body"><div class="size-chips" id="fSizes"></div></div></details>
        <details class="filter-group" open><summary>Availability</summary>
          <div class="filter-body"><label class="check"><span><input type="checkbox" id="fStock" ${query.availability === 'in' ? 'checked' : ''}> In stock only</span></label></div>
        </details>
        <div class="filters-apply"><button class="btn btn-block" data-close-filters>Show results</button></div>
      </aside>
      <section>
        <div class="toolbar">
          <button class="btn btn-ghost btn-sm filter-btn" id="openFilters"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg> Filters</button>
          <span class="count" id="count">Loading…</span>
          <label><span class="sr-only">Sort by</span>
            <select class="select" id="sort">${SORTS.map(([v, l]) => `<option value="${v}" ${query.sort === v ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select>
          </label>
        </div>
        <div class="active-filters" id="active"></div>
        <div class="grid" id="results">${skeletonCards(9)}</div>
      </section>
    </div>
  </div>`;

  const go = (patch) => {
    const next = { ...query, ...patch };
    Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] == null) delete next[k]; });
    delete next.category;
    const qsStr = new URLSearchParams(next).toString();
    navigate(`${location.pathname}${qsStr ? `?${qsStr}` : ''}`, { replace: true, keepScroll: true });
  };

  const data = await catalog.products({ ...query, category });
  const { facets } = data;

  $('#fColors', el).innerHTML = Object.entries(facets.colors).sort((a, b) => b[1] - a[1]).map(([c, n]) =>
    `<button class="swatch ${selected.colors.has(c) ? 'on' : ''}" data-color="${esc(c)}" style="background:${COLOR_HEX[c] || '#ccc'}" title="${esc(c)} (${n})" aria-label="${esc(c)}" aria-pressed="${selected.colors.has(c)}"></button>`).join('');
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'];
  $('#fSizes', el).innerHTML = Object.keys(facets.sizes).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)).map((s) =>
    `<button class="chip ${selected.sizes.has(s) ? 'on' : ''}" data-fsize="${s}" aria-pressed="${selected.sizes.has(s)}">${s}</button>`).join('');

  $('#count', el).textContent = `${data.total} ${data.total === 1 ? 'style' : 'styles'}`;
  $('#results', el).innerHTML = data.products.length ? data.products.map(productCard).join('')
    : `<div class="empty" style="grid-column:1/-1"><h3>No matches found</h3><p>Try removing a filter or searching for something else.</p><a class="btn btn-outline" href="shop">Clear all filters</a></div>`;

  // Active filter chips
  const chips = [];
  if (query.q) chips.push(['q', `“${query.q}”`]);
  if (query.tag) chips.push(['tag', TAG_TITLES[query.tag] || query.tag]);
  selected.colors.forEach((c) => chips.push([`color:${c}`, c]));
  selected.sizes.forEach((s) => chips.push([`size:${s}`, `Size ${s}`]));
  if (query.min || query.max) chips.push(['price', `${query.min ? inr(query.min) : '₹0'} – ${query.max ? inr(query.max) : 'any'}`]);
  if (query.availability) chips.push(['availability', 'In stock']);
  $('#active', el).innerHTML = chips.map(([k, l]) => `<button data-remove="${esc(k)}">${esc(l)}</button>`).join('') + (chips.length > 1 ? '<button data-remove="all" style="background:none;text-decoration:underline">Clear all</button>' : '');

  // Events
  el.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (sw) { toggle(selected.colors, sw.dataset.color); go({ colors: [...selected.colors].join(',') }); return; }
    const sz = e.target.closest('[data-fsize]');
    if (sz) { toggle(selected.sizes, sz.dataset.fsize); go({ sizes: [...selected.sizes].join(',') }); return; }
    const pr = e.target.closest('[data-range]');
    if (pr) { const [min, max] = pr.dataset.range.split('-'); go({ min, max }); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const k = rm.dataset.remove;
      if (k === 'all') return navigate(location.pathname);
      if (k.startsWith('color:')) { selected.colors.delete(k.slice(6)); return go({ colors: [...selected.colors].join(',') }); }
      if (k.startsWith('size:')) { selected.sizes.delete(k.slice(5)); return go({ sizes: [...selected.sizes].join(',') }); }
      if (k === 'price') return go({ min: '', max: '' });
      return go({ [k]: '' });
    }
    if (e.target.closest('#openFilters')) openFilters();
    if (e.target.closest('[data-close-filters]') || e.target.classList.contains('scrim')) closeFilters();
  });
  $('#sort', el).addEventListener('change', (e) => go({ sort: e.target.value }));
  $('#fStock', el).addEventListener('change', (e) => go({ availability: e.target.checked ? 'in' : '' }));
  const priceChange = () => go({ min: $('#fMin', el).value, max: $('#fMax', el).value });
  $('#fMin', el).addEventListener('change', priceChange);
  $('#fMax', el).addEventListener('change', priceChange);

  function openFilters() { $('#filters', el).classList.add('open'); const s = document.createElement('div'); s.className = 'scrim'; s.addEventListener('click', closeFilters); el.append(s); }
  function closeFilters() { $('#filters', el)?.classList.remove('open'); $$('.scrim', el).forEach((s) => s.remove()); }
}

function toggle(set, v) { if (set.has(v)) set.delete(v); else set.add(v); }
function keep(query, keys) {
  const o = {}; keys.forEach((k) => { if (query[k]) o[k] = query[k]; });
  const s = new URLSearchParams(o).toString();
  return s ? `?${s}` : '';
}
