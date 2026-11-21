import { catalog } from '../api.js';
import { $, $$, esc, inr, img, icons, productCard, skeletonCards, setMeta, observeReveal } from '../ui.js';
import { materialsFor, swatchStyle } from '../materials.js';

const MARQUEE = ['Kanjivaram silks', 'Kalamkari', 'Zari & brocade', 'Organza', 'Anarkalis', 'AI Virtual Try-On'];

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

  <div class="marquee" aria-hidden="true"><div class="marquee-track">
    ${MARQUEE.concat(MARQUEE).map((t, i) => `<span class="${i % 2 ? 'outline' : ''}">${t}</span>`).join('')}
  </div></div>

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

  <section class="runway">
    <div class="container section-head" style="margin-bottom:0">
      <div><span class="eyebrow">The Runway</span><h2>Every drape, styled</h2><p>Our sarees and sets on the atelier mannequin. Hover to explore, tap to shop.</p></div>
      <div class="rail-nav"><button data-runway="-1" aria-label="Previous">${icons.left}</button><button data-runway="1" aria-label="Next">${icons.right}</button></div>
    </div>
    <div class="runway-track" id="runway"></div>
  </section>

  <section class="atelier dark-zone" id="atelier">
    <div class="aurora"></div><div class="holo-grid"></div><div class="noise"></div>
    <canvas class="particles" id="particles"></canvas>
    <div class="container atelier-inner">
      <div class="reveal">
        <span class="ai-badge"><i></i> AI Atelier · Live</span>
        <h2 class="glitch" data-text="See it on you.">See it on <span class="grad">you.</span></h2>
        <p class="lead">Pick a material, choose any piece from our catalogue and upload your photo. Our AI reads your pose, maps the drape and dresses you in seconds.</p>
        <div class="mat-orbit" id="matOrbit"></div>
        <a class="atelier-cta" href="virtual-try-on">${icons.spark} Enter the AI Atelier</a>
      </div>
      <a class="atelier-stage reveal" href="virtual-try-on" aria-label="Open the AI Atelier">
        <span class="stage-ring"></span><span class="stage-ring r2"></span>
        <div class="holo-card" id="holoCard">
          <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
          <div class="scan-glow"></div><div class="scanline"></div>
          <div class="pose-dots">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 16 L40 26 L60 26 Z M40 26 L44 52 L56 52 L60 26 M44 52 L42 90 M56 52 L58 90"/></svg>
            <i style="left:50%;top:16%"></i><i style="left:40%;top:26%"></i><i style="left:60%;top:26%"></i><i style="left:44%;top:52%"></i><i style="left:56%;top:52%"></i><i style="left:42%;top:90%"></i><i style="left:58%;top:90%"></i>
          </div>
        </div>
        <span class="hud h1">Pose lock <b>✓ 33 pts</b></span>
        <span class="hud h2">Material <b id="hudMat">Silk</b></span>
        <span class="hud h3">Draping <b id="hudName">…</b></span>
      </a>
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

  // Runway lookbook (mannequin views)
  const styled = products.filter((p) => p.images[0].endsWith('-mq'));
  $('#runway', el).innerHTML = styled.map((p) => `<a class="runway-item" href="product/${p.slug}">
      <img src="${img(p.images[0])}" alt="${esc(p.name)} on the atelier mannequin" loading="lazy" width="480" height="640">
      <span class="rw-cap"><b>${esc(p.name)}</b><small>${inr(p.price)}</small></span></a>`).join('');
  $$('[data-runway]', el).forEach((b) => b.addEventListener('click', () => {
    const t = $('#runway', el); t.scrollBy({ left: Number(b.dataset.runway) * t.clientWidth * 0.7, behavior: 'smooth' });
  }));

  // AI Atelier: material chips + cycling holographic stage
  const mats = materialsFor(products);
  $('#matOrbit', el).innerHTML = mats.slice(0, 6).map((m) => `<a class="mat-chip" href="virtual-try-on?material=${m.key}"><span class="sw" style="${swatchStyle(m)}"></span>${esc(m.label)} <small>${m.count}</small></a>`).join('');
  const holo = $('#holoCard', el);
  const reel = styled.slice(0, 10);
  let atelierTimer = null;
  if (reel.length) atelierTimer = startReel(el, holo, reel, mats);
  const stopParticles = particles($('#particles', el));

  observeReveal(el);
  return () => { clearInterval(timer); clearInterval(atelierTimer); stopParticles(); };
}

// Cross-fading mannequin reel inside the holographic card, with HUD labels.
function startReel(el, holo, reel, mats) {
  let ri = 0;
  const first = document.createElement('img');
  first.alt = ''; first.src = img(reel[0].images[0], 1080);
  holo.prepend(first);
  const matOf = (p) => (mats.find((m) => m.re.test(`${p.fabric} ${p.name}`.toLowerCase())) || mats[0]).label;
  const setHud = (p) => { $('#hudMat', el).textContent = matOf(p); $('#hudName', el).textContent = p.name.split(' ').slice(0, 2).join(' '); };
  setHud(reel[0]);
  return setInterval(() => {
    ri = (ri + 1) % reel.length;
    const next = new Image(); next.alt = ''; next.className = 'out'; next.src = img(reel[ri].images[0], 1080);
    next.onload = () => {
      const prev = holo.querySelector('img');
      holo.prepend(next);
      requestAnimationFrame(() => { next.classList.remove('out'); prev?.classList.add('out'); });
      setTimeout(() => { if (prev && prev.parentNode) prev.parentNode.removeChild(prev); }, 1000);
      setHud(reel[ri]);
    };
    const g = $('.glitch', el);
    g?.classList.add('flicker'); setTimeout(() => g?.classList.remove('flicker'), 700);
  }, 3200);
}

// Golden thread particles drifting upward in the AI Atelier.
function particles(canvas) {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  let w; let h; let raf; let visible = true;
  const dots = Array.from({ length: 55 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.1, s: 0.0006 + Math.random() * 0.0016, a: Math.random() * Math.PI * 2 }));
  const size = () => { const r = canvas.getBoundingClientRect(); w = canvas.width = r.width * devicePixelRatio; h = canvas.height = r.height * devicePixelRatio; };
  const loop = () => {
    if (!visible) return;
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y -= d.s; d.a += 0.02; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
      const x = (d.x + Math.sin(d.a) * 0.01) * w; const y = d.y * h;
      ctx.beginPath(); ctx.arc(x, y, d.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(243, 201, 122, ${0.15 + 0.4 * Math.abs(Math.sin(d.a))})`; ctx.fill();
    }
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) loop(); });
  io.observe(canvas);
  size(); addEventListener('resize', size);
  return () => { visible = false; cancelAnimationFrame(raf); io.disconnect(); removeEventListener('resize', size); };
}
