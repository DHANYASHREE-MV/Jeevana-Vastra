import { catalog } from '../api.js';
import { $, $$, esc, img, icons, productCard, skeletonCards, setMeta, observeReveal } from '../ui.js';

const SLIDES = [
  { image: 'raktha-kalamkari-silk-saree-0', eyebrow: 'The Festive Edit · 2026', title: 'Draped in <em>heritage</em>,<br>made for today', text: 'Kalamkari pallus, temple borders and soft silks — our newest sarees, handpicked from India\'s weaving clusters.', cta: ['shop/sarees', 'Shop sarees'] },
  { image: 'raat-black-embroidered-palazzo-set-0', eyebrow: 'New Season Sets', title: 'Kurta sets with<br><em>quiet</em> luxury', text: 'Thread-work georgettes, chanderi and organza — three-piece sets that move from celebration to soirée.', cta: ['shop/kurta-sets', 'Shop kurta sets'] },
  { image: 'mayil-teal-silk-saree-0', eyebrow: 'Signature Experience', title: 'See it on <em>you</em><br>before you buy', text: 'Upload a photo and try any Jeevana Vastra outfit with our AI Virtual Try-On studio.', cta: ['virtual-try-on', 'Open Try-On studio'], tryon: true },
];

const TESTIMONIALS = [
  { q: 'The Mayil silk saree looked even richer in person. The zari catches the light beautifully — I got compliments all evening.', n: 'Lakshmi R.', c: 'Bengaluru', p: 'Mayil Teal Silk Saree' },
  { q: 'I tried the peach anarkali on myself with the virtual try-on before ordering. It gave me the confidence to pick the right colour!', n: 'Ananya S.', c: 'Hyderabad', p: 'Gulnaar Peach Anarkali Set' },
  { q: 'Beautiful stitching, soft fabric and the dupatta is gorgeous. Delivery was quick and the packaging felt so special.', n: 'Meera K.', c: 'Chennai', p: 'Pudina Mint Kurta Set' },
];

export async function render({ el }) {
  setMeta(null, 'Sarees, kurta sets, kurtis and anarkalis, with an AI Virtual Try-On studio.');
  el.innerHTML = `
  <section class="hero" aria-roledescription="carousel" aria-label="Featured collections">
    ${SLIDES.map((s, i) => `
      <div class="hero-slide ${i === 0 ? 'active' : ''}" aria-hidden="${i !== 0}">
        <div class="hero-copy">
          <span class="eyebrow">${s.eyebrow}</span>
          <h1>${s.title}</h1>
          <p>${s.text}</p>
          <div class="hero-cta">
            <a class="btn btn-gold" href="${s.cta[0]}">${s.tryon ? icons.spark : ''}${s.cta[1]}</a>
            ${s.tryon ? '<a class="btn btn-light" href="shop">Browse catalogue</a>' : '<a class="btn btn-light" href="virtual-try-on">Try it on you</a>'}
          </div>
        </div>
        <div class="hero-media"><img src="${img(s.image, 1080)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></div>
      </div>`).join('')}
    <div class="hero-dots" role="tablist">${SLIDES.map((_, i) => `<button role="tab" aria-label="Slide ${i + 1}" class="${i === 0 ? 'active' : ''}" data-slide="${i}"></button>`).join('')}</div>
  </section>

  <section class="section container">
    <div class="section-head center" style="justify-content:center">
      <div><span class="eyebrow">Shop by category</span><h2>Curated for every occasion</h2><div class="ornament">✦</div></div>
    </div>
    <div class="cat-grid" id="cats">${'<div class="cat-tile skeleton"></div>'.repeat(6)}</div>
  </section>

  <section class="section container" style="padding-top:0">
    <div class="section-head">
      <div><span class="eyebrow">Just arrived</span><h2>New Arrivals</h2><p>Fresh drapes and sets, added this month.</p></div>
      <div class="rail-nav"><button data-rail="-1" aria-label="Previous">${icons.left}</button><button data-rail="1" aria-label="Next">${icons.right}</button></div>
    </div>
    <div class="rail" id="newRail">${skeletonCards(4)}</div>
  </section>

  <section class="tryon-band section">
    <div class="container">
      <div class="reveal">
        <span class="eyebrow">✦ Our signature feature</span>
        <h2>The <em>Virtual Try-On</em> Studio</h2>
        <p>Not sure how a colour or drape will suit you? Upload a photo or use your camera, and see any saree or kurta set from our catalogue on you, powered by AI.</p>
        <ol class="tryon-steps">
          <li>Pick any outfit from the catalogue</li>
          <li>Upload a photo or take one with your camera</li>
          <li>Compare before &amp; after, switch outfits, save your look</li>
        </ol>
        <a class="btn btn-gold" href="virtual-try-on">${icons.spark} Start trying on</a>
      </div>
      <div class="tryon-visual reveal">
        <figure><img src="${img('gulnaar-peach-anarkali-set-0', 1080)}" alt="Gulnaar Peach Anarkali Set" loading="lazy"><figcaption>Pick an outfit</figcaption></figure>
        <span class="spark">${icons.spark}</span>
        <figure><img src="${img('pudina-mint-embroidered-kurta-set-0', 1080)}" alt="Pudina Mint Kurta Set" loading="lazy"><figcaption>See it on you</figcaption></figure>
      </div>
    </div>
  </section>

  <section class="section container">
    <div class="section-head">
      <div><span class="eyebrow">Most loved</span><h2>Bestsellers &amp; Trending</h2></div>
      <a class="link" href="shop?sort=popular">View all</a>
    </div>
    <div class="tabs" role="tablist">
      <button class="active" data-tab="bestseller" role="tab">Bestsellers</button>
      <button data-tab="trending" role="tab">Trending now</button>
      <button data-tab="sarees" role="tab">Silk sarees</button>
      <button data-tab="kurta-sets" role="tab">Kurta sets</button>
    </div>
    <div class="grid cols-4" id="featured">${skeletonCards(8)}</div>
  </section>

  <section class="offer-strip">
    <div class="container">
      <h3>Get 10% off your first festive look</h3>
      <span>Use code <code>VASTRA10</code> at checkout · Free shipping above ₹1,499</span>
    </div>
  </section>

  <section class="section container">
    <div class="section-head"><div><span class="eyebrow">Seasonal collections</span><h2>Wedding Season Edit</h2></div></div>
    <div class="promo-grid">
      <a class="promo reveal" href="shop/sarees?sort=price-desc">
        <img src="${img('samudra-teal-silk-saree-0', 1080)}" alt="Samudra Teal Silk Saree" loading="lazy">
        <div class="promo-copy"><span class="eyebrow">The Silk Story</span><h3>Temple borders &amp;<br>zari for the big day</h3><span class="btn btn-light btn-sm">Explore silks</span></div>
      </a>
      <div class="promo-stack">
        <a class="promo reveal" href="shop/dresses">
          <img src="${img('kesar-butti-anarkali-set-0', 1080)}" alt="Kesar Butti Anarkali Set" loading="lazy" style="object-position:center 30%">
          <div class="promo-copy"><span class="eyebrow">Mehendi &amp; Haldi</span><h3>Anarkalis that twirl</h3></div>
        </a>
        <a class="promo reveal" href="shop/co-ord-sets">
          <img src="${img('gerua-rust-co-ord-set-0', 1080)}" alt="Gerua Rust Co-ord Set" loading="lazy" style="object-position:center 30%">
          <div class="promo-copy"><span class="eyebrow">Modern Ethnic</span><h3>Co-ords &amp; Kurtis</h3></div>
        </a>
      </div>
    </div>
  </section>

  <section class="section container" style="padding-top:0">
    <div class="film">
      <div class="film-frame reveal">
        <img src="${img('ivory-kalamkari-pallu-saree-0', 1080)}" alt="" loading="lazy" id="filmPoster">
        <button class="film-play" id="filmPlay" aria-label="Play collection film"><span><svg viewBox="0 0 24 24" style="fill:#fff;stroke:none"><path d="M8 5v14l11-7z"/></svg></span></button>
      </div>
      <div class="reveal">
        <span class="eyebrow">The collection film</span>
        <h2>Six yards of<br>stories</h2>
        <p style="color:var(--earth-2);max-width:460px">Every Jeevana Vastra piece is chosen for the hands that made it: kalamkari artists, zari weavers and block printers. Watch the collection come alive.</p>
        <a class="btn btn-outline" href="shop">Shop the collection</a>
      </div>
    </div>
  </section>

  <section class="section testimonials">
    <div class="container">
      <div class="section-head center" style="justify-content:center"><div><span class="eyebrow">Kind words</span><h2>Loved by our patrons</h2><div class="ornament">✦</div></div></div>
      <div class="quote-grid">
        ${TESTIMONIALS.map((t) => `<blockquote class="quote reveal"><div class="stars">★★★★★</div><p>${esc(t.q)}</p><footer><span class="av">${t.n[0]}</span><span><b>${esc(t.n)}</b><small>${esc(t.c)} · ${esc(t.p)}</small></span></footer></blockquote>`).join('')}
      </div>
    </div>
  </section>`;

  // Hero slider
  let current = 0;
  const slides = $$('.hero-slide', el); const dots = $$('.hero-dots button', el);
  const go = (i) => {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle('active', k === current); s.setAttribute('aria-hidden', k !== current); });
    dots.forEach((d, k) => { d.classList.remove('active'); if (k === current) { void d.offsetWidth; d.classList.add('active'); } });
  };
  let timer = setInterval(() => go(current + 1), 6000);
  dots.forEach((d) => d.addEventListener('click', () => { clearInterval(timer); go(Number(d.dataset.slide)); timer = setInterval(() => go(current + 1), 6000); }));

  // Film
  $('#filmPlay', el).addEventListener('click', (e) => {
    const frame = e.currentTarget.parentElement;
    frame.innerHTML = '<video src="media/collection.mp4" controls autoplay playsinline preload="auto"></video>';
  });

  // Data
  const [cats, all] = await Promise.all([catalog.categories(), catalog.products({ sort: 'popular' })]);
  $('#cats', el).innerHTML = cats.map((c) => `<a class="cat-tile" href="shop/${c.slug}"><img src="${img(c.image)}" alt="${esc(c.name)}" loading="lazy"><div class="cat-label"><h3>${esc(c.name)}</h3><small>${c.count} styles</small></div></a>`).join('')
    + '<a class="cat-tile new-tile" href="shop?tag=new"><span class="eyebrow" style="color:var(--gold-soft)">Just in</span><h3>New<br>Arrivals</h3><small style="letter-spacing:.14em;text-transform:uppercase;font-size:11px;margin-top:10px">Shop the latest →</small></a>';

  const products = all.products;
  const newest = [...products].filter((p) => p.tags.includes('new')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('#newRail', el).innerHTML = newest.map(productCard).join('');
  $$('[data-rail]', el).forEach((b) => b.addEventListener('click', () => {
    const rail = $('#newRail', el);
    rail.scrollBy({ left: Number(b.dataset.rail) * rail.clientWidth * 0.8, behavior: 'smooth' });
  }));

  const showTab = (key) => {
    const list = ['sarees', 'kurta-sets'].includes(key) ? products.filter((p) => p.category === key) : products.filter((p) => p.tags.includes(key));
    $('#featured', el).innerHTML = list.slice(0, 8).map(productCard).join('');
  };
  showTab('bestseller');
  $$('[data-tab]', el).forEach((b) => b.addEventListener('click', () => {
    $$('[data-tab]', el).forEach((x) => x.classList.toggle('active', x === b));
    showTab(b.dataset.tab);
  }));

  observeReveal(el);
  return () => clearInterval(timer);
}
