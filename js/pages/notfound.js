import { setMeta } from '../ui.js';

export async function render({ el }) {
  setMeta('Page not found');
  el.innerHTML = '<div class="container empty" style="padding:120px 20px"><span class="eyebrow">404</span><h2>This page has wandered off</h2><p>Let us take you back to the collection.</p><a class="btn" href="shop">Shop all</a></div>';
}
