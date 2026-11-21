import { api } from '../api.js';
import { productCard, setMeta } from '../ui.js';
import { subscribe } from '../store.js';

export async function render({ el }) {
  setMeta('Wishlist');
  const draw = async () => {
    const { products } = await api.get('/wishlist');
    el.innerHTML = `<div class="container" style="padding-bottom:80px">
      <div class="page-head"><nav class="crumbs"><a href="./">Home</a><span>/</span><span>Wishlist</span></nav><h1>Your Wishlist</h1>
      <p>${products.length ? `${products.length} saved ${products.length === 1 ? 'style' : 'styles'}` : ''}</p></div>
      ${products.length ? `<div class="grid" style="margin-top:20px">${products.map(productCard).join('')}</div>`
        : '<div class="empty"><h2>Nothing saved yet</h2><p>Tap the heart on any product to keep it here.</p><a class="btn" href="shop">Explore the collection</a></div>'}
    </div>`;
  };
  await draw();
  return subscribe((what) => { if (what === 'wishlist') draw(); });
}
