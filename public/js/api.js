// Thin fetch wrapper for the JSON API.
export class ApiError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

// Static builds (GitHub Pages) have no server: the same routes are answered in the browser.
export const STATIC = !!window.JV_STATIC;
let staticBackend = null;

async function request(method, url, body) {
  if (STATIC) {
    staticBackend = staticBackend || await import('./static-backend.js');
    try { return JSON.parse(JSON.stringify(await staticBackend.handle(method, url, body || {}))); } catch (e) { throw new ApiError(e.message || 'Something went wrong', e.status || 500, {}); }
  }
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong', res.status, data);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  patch: (url, body) => request('PATCH', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url, body) => request('DELETE', url, body),
};

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
export const catalog = {
  products: (params = {}) => api.get(`/products?${qs(params)}`),
  product: (slug) => api.get(`/products/${encodeURIComponent(slug)}`),
  categories: () => api.get('/categories'),
  suggest: (q) => api.get(`/search/suggest?${qs({ q })}`),
};
