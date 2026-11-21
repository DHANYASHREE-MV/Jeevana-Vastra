// Order confirmation + tracking timeline.
import { api } from '../api.js';
import { state } from '../store.js';
import { $, esc, inr, icons, setMeta, toast, requireLoginHtml } from '../ui.js';
import { orderCard } from './account.js';
import { addressText } from '../components/address.js';

const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const PAY = { cod: 'Cash on delivery', upi: 'UPI', card: 'Card' };

export async function render({ el, params, query }) {
  setMeta(`Order #${params.number}`);
  if (!state.user) { el.innerHTML = `<div class="container">${requireLoginHtml(location.pathname, 'Sign in to view this order')}</div>`; return; }
  let o = await api.get(`/orders/${params.number}`);
  const draw = () => {
    el.innerHTML = `<div class="container" style="padding-bottom:80px">
      ${query.placed ? `<div class="success-hero"><div class="tick">${icons.check}</div><h1>Thank you for your order!</h1><p style="color:var(--earth-2)">Order <b>#${o.number}</b> is confirmed. We have sent the details to ${esc(state.user.email)}.</p></div>`
        : `<div class="page-head"><nav class="crumbs"><a href="account">Account</a><span>/</span><a href="account/orders">Orders</a><span>/</span><span>#${o.number}</span></nav><h1>Track order</h1></div>`}
      <div class="panel" style="margin-top:20px">
        <h3>${o.status === 'cancelled' ? 'This order was cancelled' : o.status === 'delivered' ? 'Delivered' : `Arriving by ${new Date(o.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`}
          ${o.cancellable ? '<button class="btn btn-ghost btn-sm" id="cancel">Cancel order</button>' : ''}</h3>
        <div class="track">${o.timeline.map((s) => `<div class="track-step ${s.done ? 'done' : ''}"><span class="dot"></span><span>${esc(s.label)}${s.at && s.done ? `<small>${when(s.at)}</small>` : ''}</span></div>`).join('')}</div>
      </div>
      <div class="bag-layout" style="padding:0">
        <div>${orderCard(o, { link: false })}</div>
        <div class="summary">
          <h3>Details</h3>
          <div class="sum-row"><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>
          ${o.discount ? `<div class="sum-row"><span>Coupon ${esc(o.coupon)}</span><span class="save">− ${inr(o.discount)}</span></div>` : ''}
          <div class="sum-row"><span>Shipping</span><span>${o.shipping ? inr(o.shipping) : 'Free'}</span></div>
          <div class="sum-row total"><span>Total</span><span>${inr(o.total)}</span></div>
          <p style="font-size:13px;margin-top:14px"><b>Payment:</b> ${PAY[o.paymentMethod]}</p>
          <p style="font-size:13px"><b>Deliver to:</b> ${esc(o.address.name)}<br>${addressText(o.address)}</p>
          <a class="btn btn-outline btn-block" href="shop">Continue shopping</a>
        </div>
      </div>
    </div>`;
    $('#cancel', el)?.addEventListener('click', async () => {
      if (!confirm('Cancel this order? Items will be released back to stock.')) return;
      try { o = await api.post(`/orders/${o.number}/cancel`); draw(); toast('Order cancelled'); } catch (err) { toast(esc(err.message), { type: 'error' }); }
    });
  };
  draw();
}
