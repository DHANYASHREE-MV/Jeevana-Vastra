// Global client state: signed-in user, bag and wishlist. Components subscribe to changes.
import { api } from './api.js';

const listeners = new Set();
export const state = { user: null, cart: { items: [], count: 0 }, wishlist: new Set(), ready: false };

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { listeners.forEach((fn) => fn(what)); }

export async function init() {
  const [me, cart, wl] = await Promise.all([api.get('/account/me'), api.get('/cart'), api.get('/wishlist')]);
  state.user = me.user;
  state.cart = cart;
  state.wishlist = new Set(wl.ids);
  state.ready = true;
  emit('all');
}

export async function refreshAfterAuth() {
  const [cart, wl] = await Promise.all([api.get('/cart'), api.get('/wishlist')]);
  state.cart = cart; state.wishlist = new Set(wl.ids);
  emit('all');
}

export const cart = {
  async add(productId, size, qty = 1) { state.cart = await api.post('/cart', { productId, size, qty }); emit('cart'); return state.cart; },
  async update(productId, size, qty, coupon) { state.cart = await api.patch('/cart', { productId, size, qty, coupon }); emit('cart'); return state.cart; },
  async remove(productId, size, coupon) { state.cart = await api.del('/cart', { productId, size, coupon }); emit('cart'); return state.cart; },
  async load(coupon) { state.cart = await api.get(`/cart${coupon ? `?coupon=${encodeURIComponent(coupon)}` : ''}`); emit('cart'); return state.cart; },
};

export const wishlist = {
  has: (id) => state.wishlist.has(id),
  async toggle(id) {
    const res = await api.post(`/wishlist/${id}`);
    state.wishlist = new Set(res.ids);
    emit('wishlist');
    return res.saved;
  },
};

export const auth = {
  async login(email, password) { const r = await api.post('/account/login', { email, password }); state.user = r.user; await refreshAfterAuth(); emit('user'); return r.user; },
  async register(data) { const r = await api.post('/account/register', data); state.user = r.user; await refreshAfterAuth(); emit('user'); return r.user; },
  async logout() { await api.post('/account/logout'); state.user = null; await refreshAfterAuth(); emit('user'); },
  setUser(u) { state.user = u; emit('user'); },
};
