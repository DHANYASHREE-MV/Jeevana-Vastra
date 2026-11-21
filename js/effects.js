// Retail motion layer: brand intro, scroll progress, custom cursor, 3D card tilt + sheen,
// magnetic buttons, staggered card reveals and fly-to-bag. Everything is delegated on the
// document, so it keeps working as pages re-render. Disabled for reduced motion; cursor and
// tilt only run on devices with a fine pointer (mouse / trackpad).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

export function initEffects() {
  if (!reduce && 'IntersectionObserver' in window) document.documentElement.classList.add('fx');
  intro();
  progressBar();
  if (reduce) return;
  staggerCards();
  if (!fine) return;
  cursor();
  tilt();
  magnetic();
}

// ---------- Brand intro (once per browser session) ----------
function intro() {
  let seen = false;
  try { seen = sessionStorage.getItem('jv_intro') === '1'; sessionStorage.setItem('jv_intro', '1'); } catch { /* storage off */ }
  if (seen || reduce) return;
  const el = document.createElement('div');
  el.className = 'jv-intro';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="jv-intro-panel top"></div><div class="jv-intro-panel bottom"></div>
    <div class="jv-intro-mark">
      <svg viewBox="0 0 40 40"><path d="M20 4c4 6 4 12 0 18-4-6-4-12 0-18Z"/><path d="M20 22c-6-1-11-5-13-11 6 0 11 4 13 11Zm0 0c6-1 11-5 13-11-6 0-11 4-13 11Z"/><path d="M8 28h24M11 32h18M15 36h10"/></svg>
      <span>Jeevana Vastra</span><small>Ethnic Couture</small>
    </div>`;
  document.body.append(el);
  setTimeout(() => el.classList.add('open'), 1300);
  setTimeout(() => el.remove(), 2400);
}

// ---------- Scroll progress ----------
function progressBar() {
  const bar = document.createElement('div');
  bar.className = 'jv-progress';
  document.body.append(bar);
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}

// ---------- Custom cursor ----------
function cursor() {
  const dot = document.createElement('div'); dot.className = 'jv-cursor-dot';
  const ring = document.createElement('div'); ring.className = 'jv-cursor-ring';
  ring.innerHTML = '<span></span>';
  document.body.append(ring, dot);
  document.documentElement.classList.add('has-cursor');
  let x = innerWidth / 2; let y = innerHeight / 2; let rx = x; let ry = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px, ${y}px)`; }, { passive: true });
  const loop = () => {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const label = t.closest('.card-media, .runway-item') ? 'View' : t.closest('.atelier-stage, .tryon-cta') ? 'Try' : '';
    ring.querySelector('span').textContent = label;
    ring.classList.toggle('label', !!label);
    ring.classList.toggle('hover', !label && !!t.closest('a, button, [role="button"], input, select, label'));
  });
  document.addEventListener('pointerdown', () => ring.classList.add('down'));
  document.addEventListener('pointerup', () => ring.classList.remove('down'));
  document.addEventListener('mouseleave', () => { dot.style.opacity = 0; ring.style.opacity = 0; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = 1; ring.style.opacity = 1; });
}

// ---------- 3D tilt + light sheen on product imagery ----------
function tilt() {
  const SEL = '.card-media, .cat-tile, .promo, .runway-item';
  let active = null;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.(SEL);
    if (active && active !== el) reset(active);
    active = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
    const max = el.classList.contains('promo') ? 3 : 7;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg)`;
    el.style.setProperty('--sx', `${px * 100}%`);
    el.style.setProperty('--sy', `${py * 100}%`);
    el.classList.add('tilting');
  }, { passive: true });
  function reset(el) { el.style.transform = ''; el.classList.remove('tilting'); }
}

// ---------- Magnetic primary buttons ----------
function magnetic() {
  const SEL = '.btn-gold, .nav-tryon, .atelier-cta';
  document.addEventListener('pointermove', (e) => {
    document.querySelectorAll('.magnet-on').forEach((b) => { if (!b.contains(e.target)) { b.style.transform = ''; b.classList.remove('magnet-on'); } });
    const b = e.target.closest?.(SEL);
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.classList.add('magnet-on');
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
  }, { passive: true });
}

// ---------- Staggered reveal of product cards ----------
function staggerCards() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const siblings = [...en.target.parentElement.children];
      en.target.style.animationDelay = `${(siblings.indexOf(en.target) % 4) * 90}ms`;
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -40px 0px' });
  const scan = () => document.querySelectorAll('.card:not(.in):not([data-io])').forEach((c) => { c.dataset.io = '1'; io.observe(c); });
  new MutationObserver(scan).observe(document.getElementById('app'), { childList: true, subtree: true });
  scan();
}

// ---------- Fly-to-bag ----------
export function flyToBag(imgEl) {
  const bag = document.querySelector('a[href="bag"] svg, a[href$="/bag"] svg');
  if (!imgEl || !bag || reduce) return;
  const a = imgEl.getBoundingClientRect(); const b = bag.getBoundingClientRect();
  const clone = imgEl.cloneNode();
  clone.className = 'jv-fly';
  Object.assign(clone.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(clone);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2); const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  clone.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '4px' },
    { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 120}px) scale(.35)`, opacity: 0.9, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(.05)`, opacity: 0.2, borderRadius: '50%' },
  ], { duration: 850, easing: 'cubic-bezier(.5,0,.2,1)' }).onfinish = () => clone.remove();
}
