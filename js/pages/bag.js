import { api } from '../api.js';
import { state, cart, wishlist } from '../store.js';
import { $, esc, inr, img, icons, setMeta, toast } from '../ui.js';

export function summaryHtml(c, { coupon = true, cta = '' } = {}) {
  const remaining = Math.max(0, c.freeShippingFrom - (c.subtotal - c.discount));
  return `<div class="summary">
    <h3>Order summary</h3>
    ${c.subtotal ? `<div class="ship-meter">${remaining ? `Add <b>${inr(remaining)}</b> more for free shipping` : '🎉 You have unlocked <b>free shipping</b>'}<div class="bar"><i style="width:${Math.min(100, ((c.subtotal - c.discount) / c.freeShippingFrom) * 100)}%"></i></div></div>` : ''}
    <div class="sum-row"><span>Bag total (${c.count} ${c.count === 1 ? 'item' : 'items'})</span><span>${inr(c.subtotal + c.savings)}</span></div>
    ${c.savings ? `<div class="sum-row"><span>Discount on MRP</span><span class="save">− ${inr(c.savings)}</span></div>` : ''}
    ${c.discount ? `<div class="sum-row"><span>Coupon ${esc(c.coupon)}</span><span class="save">− ${inr(c.discount)}</span></div>` : ''}
    <div class="sum-row"><span>Shipping</span><span>${c.shipping ? inr(c.shipping) : '<span class="save">Free</span>'}</span></div>
    <div class="sum-row total"><span>Total</span><span>${inr(c.total)}</span></div>
    ${coupon ? `<form class="coupon" id="couponForm"><input class="input" id="couponInput" placeholder="Coupon code" value="${esc(c.coupon || '')}" aria-label="Coupon code"><button class="btn btn-ghost btn-sm">${c.coupon ? 'Change' : 'Apply'}</button></form>
      <div class="form-error" id="couponErr">${c.coupon ? `<span style="color:var(--success)">✓ ${esc(c.couponLabel)}</span>` : '<span style="color:var(--muted)">Try VASTRA10 or FIRST200</span>'}</div>` : ''}
    ${cta}
    <div class="secure-note">${icons.lock} Secure checkout · 100% purchase protection</div>
  </div>`;
}

export function getCoupon() { try { return sessionStorage.getItem('jv_coupon') || ''; } catch { return ''; } }
export function setCoupon(c) { try { if (c) sessionStorage.setItem('jv_coupon', c); else sessionStorage.removeItem('jv_coupon'); } catch { /* ignore */ } }

export async function render({ el, navigate }) {
  setMeta('Shopping Bag');
  let c = await cart.load(getCoupon());

  const draw = () => {
    if (!c.items.length) {
      el.innerHTML = `<div class="container"><div class="empty" style="padding:100px 20px"><h2>Your bag is empty</h2><p>Discover sarees and sets made for your next celebration.</p><a class="btn" href="shop?tag=new">Shop new arrivals</a></div></div>`;
      return;
    }
    el.innerHTML = `<div class="container">
      <div class="page-head"><nav class="crumbs"><a href="./">Home</a><span>/</span><span>Bag</span></nav><h1>Shopping Bag</h1></div>
      <div class="bag-layout">
        <div>${c.items.map((i) => `
          <div class="line" data-pid="${i.productId}" data-size="${esc(i.size)}">
            <a href="product/${i.slug}"><img src="${img(i.image)}" alt="${esc(i.name)}"></a>
            <div>
              <h3><a href="product/${i.slug}">${esc(i.name)}</a></h3>
              <div class="line-meta">Size: ${esc(i.size)} · Colour: ${esc(i.color)}${i.qty > i.available ? ` · <span style="color:var(--danger)">Only ${i.available} left</span>` : ''}</div>
              <div class="line-actions">
                <div class="qty"><button data-step="-1" aria-label="Decrease">−</button><input value="${i.qty}" readonly aria-label="Quantity"><button data-step="1" aria-label="Increase" ${i.qty >= Math.min(10, i.available) ? 'disabled' : ''}>+</button></div>
                <button class="link-btn" data-move>Move to wishlist</button>
                <button class="link-btn" data-remove style="color:var(--muted)">Remove</button>
              </div>
            </div>
            <div class="line-price"><b>${inr(i.lineTotal)}</b>${i.mrp > i.price ? `<s>${inr(i.mrp * i.qty)}</s>` : ''}</div>
          </div>`).join('')}
          <a class="link" href="shop" style="display:inline-block;margin-top:22px">← Continue shopping</a>
        </div>
        ${summaryHtml(c, { cta: `<a class="btn btn-block" href="checkout" style="margin-top:10px">Proceed to checkout</a>` })}
      </div>
    </div>`;
  };
  draw();

  el.addEventListener('click', async (e) => {
    const line = e.target.closest('.line');
    if (!line) return;
    const pid = Number(line.dataset.pid); const size = line.dataset.size;
    const item = c.items.find((i) => i.productId === pid && i.size === size);
    try {
      if (e.target.closest('[data-step]')) c = await cart.update(pid, size, item.qty + Number(e.target.closest('[data-step]').dataset.step), c.coupon);
      else if (e.target.closest('[data-remove]')) { c = await cart.remove(pid, size, c.coupon); toast('Removed from bag'); }
      else if (e.target.closest('[data-move]')) {
        if (!wishlist.has(pid)) await wishlist.toggle(pid);
        c = await cart.remove(pid, size, c.coupon);
        toast('Moved to wishlist', { link: { href: '/wishlist', label: 'View' } });
      } else return;
      draw();
    } catch (err) { toast(esc(err.message), { type: 'error' }); }
  });

  el.addEventListener('submit', async (e) => {
    if (e.target.id !== 'couponForm') return;
    e.preventDefault();
    const code = $('#couponInput', el).value.trim();
    try {
      if (!code) { setCoupon(''); c = await cart.load(); draw(); return; }
      c = await api.post('/cart/coupon', { code });
      state.cart = c; setCoupon(c.coupon);
      draw();
      toast(`Coupon ${esc(c.coupon)} applied — you save ${inr(c.discount)}`);
    } catch (err) { $('#couponErr', el).textContent = err.message; }
  });
}
