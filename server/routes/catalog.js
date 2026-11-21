// Products, categories, search, filters and sorting.
const express = require('express');
const db = require('../db');

const router = express.Router();
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'];

function toProduct(row) {
  if (!row) return null;
  const stock = JSON.parse(row.stock);
  const total = Object.values(stock).reduce((a, b) => a + b, 0);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    categoryName: row.category_name,
    garment: row.garment,
    description: row.description,
    fabric: row.fabric,
    color: row.color,
    price: row.price,
    mrp: row.mrp,
    discount: row.mrp > row.price ? Math.round((1 - row.price / row.mrp) * 100) : 0,
    images: JSON.parse(row.images),
    tryonImage: row.tryon_image || JSON.parse(row.images)[0],
    sizes: Object.keys(stock).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)),
    stock,
    inStock: total > 0,
    tags: JSON.parse(row.tags),
    popularity: row.popularity,
    rating: row.rating,
    reviews: row.reviews,
    flatlay: !!row.flatlay,
    createdAt: row.created_at,
  };
}

const BASE = `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.slug = p.category`;

function allProducts() {
  return db.prepare(BASE).all().map(toProduct);
}

router.get('/categories', (req, res) => {
  const cats = db.prepare(`SELECT c.*, COUNT(p.id) AS count FROM categories c
    LEFT JOIN products p ON p.category = c.slug GROUP BY c.slug ORDER BY c.sort`).all();
  const covers = Object.fromEntries(allProducts().map((p) => [p.slug, p.images[0]]));
  res.json(cats.map((c) => ({ slug: c.slug, name: c.name, blurb: c.blurb, count: c.count, image: covers[c.cover] })));
});

// GET /api/products?category=&q=&colors=a,b&sizes=M,L&min=&max=&availability=in&tag=new&sort=popular|price-asc|price-desc|newest|discount
router.get('/products', (req, res) => {
  const q = req.query;
  let list = allProducts();
  const facetsBase = list;

  if (q.category && q.category !== 'all') list = list.filter((p) => p.category === q.category);
  if (q.tag) list = list.filter((p) => p.tags.includes(q.tag));
  if (q.q) {
    const terms = String(q.q).toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((p) => {
      const hay = `${p.name} ${p.categoryName} ${p.color} ${p.fabric} ${p.description} ${p.garment}`.toLowerCase();
      return terms.every((t) => hay.includes(t) || hay.includes(t.replace(/s$/, '')));
    });
  }
  const scoped = list; // facets reflect category/search but not the facet filters themselves
  if (q.colors) { const set = String(q.colors).split(','); list = list.filter((p) => set.includes(p.color)); }
  if (q.sizes) {
    const set = String(q.sizes).split(',');
    list = list.filter((p) => set.some((s) => (p.stock[s] || 0) > 0));
  }
  if (q.min) list = list.filter((p) => p.price >= Number(q.min));
  if (q.max) list = list.filter((p) => p.price <= Number(q.max));
  if (q.availability === 'in') list = list.filter((p) => p.inStock);

  const sorters = {
    popular: (a, b) => b.popularity - a.popularity,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    discount: (a, b) => b.discount - a.discount,
  };
  list.sort(sorters[q.sort] || sorters.popular);

  const count = (arr, fn) => arr.reduce((m, p) => { fn(p).forEach((k) => { m[k] = (m[k] || 0) + 1; }); return m; }, {});
  res.json({
    total: list.length,
    products: list,
    facets: {
      colors: count(scoped, (p) => [p.color]),
      sizes: count(scoped, (p) => p.sizes),
      price: { min: Math.min(...facetsBase.map((p) => p.price)), max: Math.max(...facetsBase.map((p) => p.price)) },
    },
  });
});

router.get('/products/:slug', (req, res) => {
  const product = toProduct(db.prepare(`${BASE} WHERE p.slug = ?`).get(req.params.slug));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const related = allProducts()
    .filter((p) => p.slug !== product.slug && (p.category === product.category || p.color === product.color))
    .sort((a, b) => (b.category === product.category) - (a.category === product.category) || b.popularity - a.popularity)
    .slice(0, 8);
  res.json({ product, related });
});

router.get('/search/suggest', (req, res) => {
  const term = String(req.query.q || '').toLowerCase().trim();
  if (!term) return res.json([]);
  const hits = allProducts().filter((p) => `${p.name} ${p.color} ${p.categoryName}`.toLowerCase().includes(term))
    .slice(0, 6).map((p) => ({ slug: p.slug, name: p.name, price: p.price, image: p.images[0], category: p.categoryName }));
  res.json(hits);
});

module.exports = { router, toProduct, BASE };
