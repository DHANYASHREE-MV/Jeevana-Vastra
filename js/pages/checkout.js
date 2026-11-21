import { api } from '../api.js';
import { state, cart } from '../store.js';
import { $, esc, inr, img, setMeta, toast, requireLoginHtml } from '../ui.js';
import { summaryHtml, getCoupon, setCoupon } from './bag.js';
import { addressForm, addressText } from '../components/address.js';

export async function render({ el, navigate }) {
  setMeta('Secure Checkout');
  if (!state.user) { el.innerHTML = `<div class="container">${requireLoginHtml('/checkout', 'Sign in to check out')}</div>`; return; }
  const c = await cart.load(getCoupon());
  if (!c.items.length) { navigate('/bag', { replace: true }); return; }
  let addresses = await api.get('/account/addresses');
  let selected = addresses.find((a) => a.is_default)?.id || addresses[0]?.id;

  const drawAddresses = () => {
    $('#addrList', el).innerHTML = addresses.length ? `<div class="addr-grid">${addresses.map((a) => `
      <label class="addr"><input type="radio" name="addr" value="${a.id}" ${a.id === selected ? 'checked' : ''}>
        <b>${esc(a.name)} <span class="lbl">${esc(a.label)}</span></b>${addressText(a)}</label>`).join('')}</div>`
      : '<p style="color:var(--muted)">Add a delivery address to continue.</p>';
  };

  el.innerHTML = `<div class="container">
    <div class="page-head"><nav class="crumbs"><a href="bag">Bag</a><span>/</span><span>Checkout</span></nav><h1>Secure Checkout</h1></div>
    <div class="steps"><span>Bag</span> — <span class="on">Address &amp; payment</span> — <span>Confirmation</span></div>
    <div class="bag-layout">
      <div>
        <div class="panel"><h3>Delivery address <button class="btn btn-ghost btn-sm" id="addAddr">+ Add new</button></h3><div id="addrList"></div></div>
        <div class="panel"><h3>Payment method</h3>
          <div class="pay-opts">
            <label class="pay"><input type="radio" name="pay" value="upi" checked><span><b>UPI</b><small>Google Pay, PhonePe, Paytm or any UPI app</small></span></label>
            <label class="pay"><input type="radio" name="pay" value="card"><span><b>Credit / Debit card</b><small>Visa, Mastercard, RuPay — processed by our PCI-DSS payment partner</small></span></label>
            <label class="pay"><input type="radio" name="pay" value="cod"><span><b>Cash on delivery</b><small>Pay when your order arrives</small></span></label>
          </div>
          <p class="notice" style="margin-top:14px">Demo store: online payments are simulated, so no money is charged. Card details are never collected on this site; in production they are entered on the payment gateway's secure page.</p>
        </div>
        <div class="panel"><h3>Items (${c.count})</h3>
          ${c.items.map((i) => `<div class="order-item" style="margin-bottom:10px"><img src="${img(i.image)}" alt=""><span><b>${esc(i.name)}</b><br><small style="color:var(--muted)">Size ${esc(i.size)} · Qty ${i.qty}</small></span><span style="margin-left:auto">${inr(i.lineTotal)}</span></div>`).join('')}
        </div>
      </div>
      <div>${summaryHtml(c, { coupon: false, cta: `<div class="form-error" id="err"></div><button class="btn btn-block" id="placeOrder">Place order · ${inr(c.total)}</button>` })}</div>
    </div>
  </div>`;
  drawAddresses();

  el.addEventListener('change', (e) => { if (e.target.name === 'addr') selected = Number(e.target.value); });
  $('#addAddr', el).addEventListener('click', async () => {
    const res = await addressForm(null, state.user);
    addresses = res.addresses; selected = res.id; drawAddresses();
  });
  $('#placeOrder', el).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!selected) { $('#err', el).textContent = 'Please add a delivery address'; return; }
    btn.classList.add('is-loading');
    try {
      const paymentMethod = el.querySelector('input[name="pay"]:checked').value;
      if (paymentMethod !== 'cod') { btn.textContent = 'Authorising payment…'; await new Promise((r) => setTimeout(r, 1200)); }
      const order = await api.post('/checkout', { addressId: selected, paymentMethod, coupon: c.coupon });
      setCoupon('');
      await cart.load();
      navigate(`/account/orders/${order.number}?placed=1`, { replace: true });
    } catch (err) {
      $('#err', el).textContent = err.message;
      btn.classList.remove('is-loading'); btn.textContent = `Place order · ${inr(c.total)}`;
      toast(esc(err.message), { type: 'error' });
    }
  });
}
