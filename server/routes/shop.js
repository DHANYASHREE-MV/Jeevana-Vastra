// Cart, wishlist, coupons, checkout and orders.
const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const { toProduct, BASE } = require('./catalog');
const { requireUser } = require('../auth');

const router = express.Router();

const FREE_SHIPPING_FROM = 1499;
const SHIPPING_FEE = 99;
const COUPONS = {
  VASTRA10: { label: '10% off your order', apply: (sub) => Math.round(sub * 0.1) },
  FIRST200: { label: '₹200 off orders above ₹1,999', apply: (sub) => (sub >= 1999 ? 200 : 0), min: 1999 },
};

function productById(id) {
  return toProduct(db.prepare(`${BASE} WHERE p.id = ?`).get(id));
}

function cartFor(owner, coupon) {
  const rows = db.prepare('SELECT product_id, size, qty FROM cart_items WHERE owner = ? ORDER BY added_at').all(owner);
  const items = rows.map((r) => {
    const p = productById(r.product_id);
    const available = p.stock[r.size] || 0;
    return {
      productId: p.id, slug: p.slug, name: p.name, image: p.images[0], color: p.color, size: r.size,
      qty: r.qty, price: p.price, mrp: p.mrp, lineTotal: p.price * r.qty, available,
    };
  });
  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const mrpTotal = items.reduce((a, i) => a + i.mrp * i.qty, 0);
  const code = coupon && COUPONS[coupon.toUpperCase()] ? coupon.toUpperCase() : null;
  const discount = code ? COUPONS[code].apply(subtotal) : 0;
  const shipping = subtotal === 0 || subtotal - discount >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  return {
    items, count: items.reduce((a, i) => a + i.qty, 0), subtotal, savings: mrpTotal - subtotal,
    coupon: code, couponLabel: code ? COUPONS[code].label : null, discount, shipping,
    total: subtotal - discount + shipping, freeShippingFrom: FREE_SHIPPING_FROM,
  };
}

// ---------- Cart ----------
router.get('/cart', (req, res) => res.json(cartFor(req.owner, req.query.coupon)));

router.post('/cart', (req, res) => {
  const { productId, size, qty = 1 } = req.body || {};
  const p = productById(Number(productId));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  if (!p.sizes.includes(size)) return res.status(400).json({ error: 'Please choose a size' });
  const current = db.prepare('SELECT qty FROM cart_items WHERE owner=? AND product_id=? AND size=?').get(req.owner, p.id, size);
  const next = Math.min((current ? current.qty : 0) + Math.max(1, Number(qty) || 1), 10, p.stock[size] || 0);
  if (next < 1) return res.status(409).json({ error: `Size ${size} is sold out` });
  db.prepare(`INSERT INTO cart_items (owner, product_id, size, qty) VALUES (?,?,?,?)
    ON CONFLICT(owner, product_id, size) DO UPDATE SET qty = excluded.qty`).run(req.owner, p.id, size, next);
  res.json(cartFor(req.owner));
});

router.patch('/cart', (req, res) => {
  const { productId, size, qty } = req.body || {};
  const p = productById(Number(productId));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const n = Math.min(Number(qty) || 0, 10, p.stock[size] || 0);
  if (n <= 0) db.prepare('DELETE FROM cart_items WHERE owner=? AND product_id=? AND size=?').run(req.owner, p.id, size);
  else db.prepare('UPDATE cart_items SET qty=? WHERE owner=? AND product_id=? AND size=?').run(n, req.owner, p.id, size);
  res.json(cartFor(req.owner, req.body.coupon));
});

router.delete('/cart', (req, res) => {
  const { productId, size } = req.body || {};
  db.prepare('DELETE FROM cart_items WHERE owner=? AND product_id=? AND size=?').run(req.owner, Number(productId), size);
  res.json(cartFor(req.owner, req.body && req.body.coupon));
});

router.post('/cart/coupon', (req, res) => {
  const code = String((req.body && req.body.code) || '').toUpperCase();
  const coupon = COUPONS[code];
  if (!coupon) return res.status(400).json({ error: 'That code is not valid' });
  const cart = cartFor(req.owner, code);
  if (coupon.min && cart.subtotal < coupon.min) return res.status(400).json({ error: `Add items worth ₹${coupon.min - cart.subtotal} more to use ${code}` });
  res.json(cart);
});

// ---------- Wishlist ----------
router.get('/wishlist', (req, res) => {
  const ids = db.prepare('SELECT product_id FROM wishlist WHERE owner=? ORDER BY added_at DESC').all(req.owner).map((r) => r.product_id);
  res.json({ ids, products: ids.map(productById).filter(Boolean) });
});

router.post('/wishlist/:id', (req, res) => {
  const id = Number(req.params.id);
  const has = db.prepare('SELECT 1 FROM wishlist WHERE owner=? AND product_id=?').get(req.owner, id);
  if (has) db.prepare('DELETE FROM wishlist WHERE owner=? AND product_id=?').run(req.owner, id);
  else if (productById(id)) db.prepare('INSERT INTO wishlist (owner, product_id) VALUES (?,?)').run(req.owner, id);
  const ids = db.prepare('SELECT product_id FROM wishlist WHERE owner=?').all(req.owner).map((r) => r.product_id);
  res.json({ saved: !has, ids });
});

// ---------- Orders ----------
const STAGES = [
  { key: 'placed', label: 'Order placed', after: 0 },
  { key: 'confirmed', label: 'Confirmed', after: 60 * 1000 },
  { key: 'packed', label: 'Packed with care', after: 30 * 60 * 1000 },
  { key: 'shipped', label: 'Shipped', after: 6 * 3600 * 1000 },
  { key: 'out', label: 'Out for delivery', after: 2 * 86400 * 1000 },
  { key: 'delivered', label: 'Delivered', after: 3 * 86400 * 1000 },
];

// Demo fulfilment: status advances with time since the order was placed.
function withTracking(row) {
  const placedAt = new Date(row.created_at.replace(' ', 'T') + 'Z').getTime();
  const elapsed = Date.now() - placedAt;
  let timeline;
  if (row.status === 'cancelled') {
    timeline = [{ key: 'placed', label: 'Order placed', at: placedAt, done: true }, { key: 'cancelled', label: 'Cancelled', done: true }];
  } else {
    timeline = STAGES.map((s) => ({ key: s.key, label: s.label, at: placedAt + s.after, done: elapsed >= s.after }));
  }
  const current = row.status === 'cancelled' ? 'cancelled' : [...timeline].reverse().find((s) => s.done).key;
  return {
    id: row.id, number: row.number, items: JSON.parse(row.items), subtotal: row.subtotal, discount: row.discount,
    shipping: row.shipping, total: row.total, coupon: row.coupon, address: JSON.parse(row.address),
    paymentMethod: row.payment_method, status: current, createdAt: placedAt,
    estimatedDelivery: placedAt + 4 * 86400000, timeline,
    cancellable: row.status !== 'cancelled' && elapsed < STAGES[3].after,
  };
}

router.get('/orders', requireUser, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  res.json(rows.map(withTracking));
});

router.get('/orders/:number', requireUser, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE number=? AND user_id=?').get(req.params.number, req.user.id);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  res.json(withTracking(row));
});

router.post('/orders/:number/cancel', requireUser, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE number=? AND user_id=?').get(req.params.number, req.user.id);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  if (!withTracking(row).cancellable) return res.status(409).json({ error: 'This order has already shipped and can no longer be cancelled.' });
  db.exec('BEGIN');
  try {
    JSON.parse(row.items).forEach((i) => restock(i.productId, i.size, i.qty));
    db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(row.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.json(withTracking(db.prepare('SELECT * FROM orders WHERE id=?').get(row.id)));
});

function restock(productId, size, delta) {
  const row = db.prepare('SELECT stock FROM products WHERE id=?').get(productId);
  const stock = JSON.parse(row.stock);
  stock[size] = (stock[size] || 0) + delta;
  db.prepare('UPDATE products SET stock=? WHERE id=?').run(JSON.stringify(stock), productId);
}

router.post('/checkout', requireUser, (req, res) => {
  const { addressId, paymentMethod, coupon } = req.body || {};
  if (!['cod', 'upi', 'card'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose a payment method' });
  const address = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(Number(addressId), req.user.id);
  if (!address) return res.status(400).json({ error: 'Choose a delivery address' });
  const cart = cartFor(req.owner, coupon);
  if (!cart.items.length) return res.status(400).json({ error: 'Your bag is empty' });
  const short = cart.items.find((i) => i.qty > i.available);
  if (short) return res.status(409).json({ error: `Only ${short.available} left of ${short.name} (${short.size}). Please update your bag.` });

  const number = `JV${Date.now().toString().slice(-6)}${crypto.randomInt(100, 999)}`;
  const snapshot = cart.items.map(({ productId, slug, name, image, color, size, qty, price }) => ({ productId, slug, name, image, color, size, qty, price }));
  const { id: _id, user_id: _u, is_default: _d, ...addr } = address;

  db.exec('BEGIN');
  try {
    cart.items.forEach((i) => restock(i.productId, i.size, -i.qty));
    db.prepare(`INSERT INTO orders (number,user_id,items,subtotal,discount,shipping,total,coupon,address,payment_method)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(number, req.user.id, JSON.stringify(snapshot), cart.subtotal, cart.discount,
      cart.shipping, cart.total, cart.coupon, JSON.stringify(addr), paymentMethod);
    db.prepare('DELETE FROM cart_items WHERE owner=?').run(req.owner);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.json(withTracking(db.prepare('SELECT * FROM orders WHERE number=?').get(number)));
});

module.exports = router;
