// Sign in / register, profile, orders, addresses and wishlist.
import { api, STATIC } from '../api.js';
import { state, auth } from '../store.js';
import { $, esc, inr, img, setMeta, toast, productCard } from '../ui.js';
import { addressForm, addressText } from '../components/address.js';

const fmtDate = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS = { placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed', shipped: 'Shipped', out: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

export async function render(ctx) {
  const { el, params, query, navigate } = ctx;
  if (!state.user) return renderAuth(el, query, navigate);
  const tab = params.tab || 'profile';
  setMeta('My Account');
  el.innerHTML = `<div class="container">
    <div class="page-head"><nav class="crumbs"><a href="./">Home</a><span>/</span><span>Account</span></nav><h1>My Account</h1></div>
    <div class="account">
      <nav class="acct-nav">
        <div class="acct-hello">Namaste, ${esc(state.user.name.split(' ')[0])}</div>
        <a href="account/profile" class="${tab === 'profile' ? 'on' : ''}">Profile</a>
        <a href="account/orders" class="${tab === 'orders' ? 'on' : ''}">Orders &amp; tracking</a>
        <a href="account/addresses" class="${tab === 'addresses' ? 'on' : ''}">Addresses</a>
        <a href="account/wishlist" class="${tab === 'wishlist' ? 'on' : ''}">Wishlist</a>
        <button id="logout">Sign out</button>
      </nav>
      <section id="pane"></section>
    </div>
  </div>`;
  $('#logout', el).addEventListener('click', async () => { await auth.logout(); toast('You have been signed out'); navigate('/'); });
  const pane = $('#pane', el);
  await ({ profile, orders, addresses, wishlist }[tab])(pane, navigate);
}

function renderAuth(el, query, navigate) {
  setMeta('Sign in');
  let mode = query.mode === 'register' ? 'register' : 'login';
  const draw = () => {
    el.innerHTML = `<div class="container"><div class="auth-wrap">
      <div class="auth-art"><img src="${img('sandhya-peach-dupatta-set-0', 1080)}" alt=""><div><span class="eyebrow" style="color:var(--gold-2)">Jeevana Vastra</span><h2>Your wardrobe of<br>heritage, saved.</h2></div></div>
      <div class="auth-form">
        <h1>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p style="color:var(--earth-2)">${mode === 'login' ? 'Sign in to track orders, save looks and check out faster.' : 'Join for faster checkout, order tracking and early access to new drops.'}</p>
        ${STATIC ? '<p class="notice">Preview site: your account, bag and orders are stored only in this browser. Do not use a real password.</p>' : ''}
        <div class="auth-switch"><button class="${mode === 'login' ? 'on' : ''}" data-mode="login">Sign in</button><button class="${mode === 'register' ? 'on' : ''}" data-mode="register">Register</button></div>
        <form id="authForm" novalidate>
          ${mode === 'register' ? `<div class="field"><label for="rName">Full name</label><input class="input" id="rName" name="name" autocomplete="name" required></div>
          <div class="field"><label for="rPhone">Mobile (optional)</label><input class="input" id="rPhone" name="phone" inputmode="numeric" maxlength="10" autocomplete="tel-national"></div>` : ''}
          <div class="field"><label for="rEmail">Email</label><input class="input" id="rEmail" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="rPass">Password</label><input class="input" id="rPass" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="8" required>${mode === 'register' ? '<small style="color:var(--muted)">At least 8 characters</small>' : ''}</div>
          <div class="form-error" id="authErr"></div>
          <button class="btn btn-block">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
      </div></div></div>`;
    el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; draw(); }));
    $('#authForm', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector('button');
      btn.classList.add('is-loading');
      try {
        const user = mode === 'login' ? await auth.login(data.email, data.password) : await auth.register(data);
        toast(`Welcome${mode === 'login' ? ' back' : ''}, ${esc(user.name.split(' ')[0])}!`);
        navigate(query.next && query.next.startsWith('/') ? query.next : '/account', { replace: true });
      } catch (err) { $('#authErr', el).textContent = err.message; btn.classList.remove('is-loading'); }
    });
  };
  draw();
}

async function profile(pane) {
  const u = state.user;
  pane.innerHTML = `<div class="panel"><h3>Personal details</h3>
    <form id="profForm" class="form-grid">
      <div class="field"><label for="pName">Full name</label><input class="input" id="pName" name="name" value="${esc(u.name)}"></div>
      <div class="field"><label for="pPhone">Mobile</label><input class="input" id="pPhone" name="phone" value="${esc(u.phone || '')}" inputmode="numeric" maxlength="10"></div>
      <div class="field full"><label>Email</label><input class="input" value="${esc(u.email)}" disabled></div>
      <div class="form-error full" id="pErr"></div>
      <div><button class="btn">Save changes</button></div>
    </form></div>
    <div class="panel"><h3>Change password</h3>
    <form id="pwForm" class="form-grid">
      <div class="field"><label for="pwC">Current password</label><input class="input" type="password" id="pwC" name="current" autocomplete="current-password"></div>
      <div class="field"><label for="pwN">New password</label><input class="input" type="password" id="pwN" name="next" autocomplete="new-password" minlength="8"></div>
      <div class="form-error full" id="pwErr"></div>
      <div><button class="btn btn-outline">Update password</button></div>
    </form></div>
    <p style="color:var(--muted);font-size:13px">Member since ${fmtDate(u.created_at.replace(' ', 'T') + 'Z')}</p>`;
  $('#profForm', pane).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await api.patch('/account/me', Object.fromEntries(new FormData(e.target))); auth.setUser(r.user); $('#pErr', pane).textContent = ''; toast('Profile updated'); } catch (err) { $('#pErr', pane).textContent = err.message; }
  });
  $('#pwForm', pane).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/account/me/password', Object.fromEntries(new FormData(e.target))); e.target.reset(); $('#pwErr', pane).textContent = ''; toast('Password updated'); } catch (err) { $('#pwErr', pane).textContent = err.message; }
  });
}

export function orderCard(o, { link = true } = {}) {
  return `<article class="order-card">
    <div class="order-head">
      <span><small>Order</small><b>#${o.number}</b></span>
      <span><small>Placed</small><b>${fmtDate(o.createdAt)}</b></span>
      <span><small>Total</small><b>${inr(o.total)}</b></span>
      <span class="status ${o.status === 'cancelled' ? 'cancelled' : ''}">${STATUS[o.status]}</span>
    </div>
    <div class="order-items">${o.items.map((i) => `<div class="order-item"><img src="${img(i.image)}" alt=""><span><a href="product/${i.slug}"><b>${esc(i.name)}</b></a><br><small style="color:var(--muted)">Size ${esc(i.size)} · Qty ${i.qty} · ${inr(i.price * i.qty)}</small></span></div>`).join('')}
      ${link ? `<div><a class="btn btn-ghost btn-sm" href="account/orders/${o.number}">Track order</a></div>` : ''}
    </div>
  </article>`;
}

async function orders(pane) {
  const list = await api.get('/orders');
  pane.innerHTML = list.length ? list.map((o) => orderCard(o)).join('')
    : '<div class="empty"><h3>No orders yet</h3><p>When you place an order it will appear here with live tracking.</p><a class="btn" href="shop">Start shopping</a></div>';
}

async function addresses(pane) {
  let list = await api.get('/account/addresses');
  const draw = () => {
    pane.innerHTML = `<div class="panel"><h3>Saved addresses <button class="btn btn-ghost btn-sm" data-add>+ Add new</button></h3>
      ${list.length ? `<div class="addr-grid">${list.map((a) => `<div class="addr ${a.is_default ? 'on' : ''}"><b>${esc(a.name)} <span class="lbl">${esc(a.label)}</span>${a.is_default ? ' <span class="lbl" style="background:var(--gold-soft)">Default</span>' : ''}</b>${addressText(a)}
        <div class="addr-actions"><button class="link-btn" data-edit="${a.id}">Edit</button><button class="link-btn" data-del="${a.id}" style="color:var(--muted)">Delete</button></div></div>`).join('')}</div>`
        : '<p style="color:var(--muted)">No saved addresses yet.</p>'}</div>`;
  };
  draw();
  pane.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) { list = (await addressForm(null, state.user)).addresses; draw(); }
    const ed = e.target.closest('[data-edit]');
    if (ed) { list = await addressForm(list.find((a) => a.id === Number(ed.dataset.edit)), state.user); draw(); }
    const del = e.target.closest('[data-del]');
    if (del && confirm('Delete this address?')) { list = await api.del(`/account/addresses/${del.dataset.del}`); draw(); toast('Address deleted'); }
  });
}

async function wishlist(pane) {
  const { products } = await api.get('/wishlist');
  pane.innerHTML = products.length ? `<div class="grid">${products.map(productCard).join('')}</div>`
    : '<div class="empty"><h3>Your wishlist is empty</h3><p>Tap the heart on any product to save it here.</p><a class="btn" href="shop">Explore the collection</a></div>';
}
