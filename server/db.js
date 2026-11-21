// SQLite persistence (Node's built-in node:sqlite — no native build step).
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'jeevana.db');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY, name TEXT NOT NULL, blurb TEXT, cover TEXT, sort INTEGER
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(slug),
  garment TEXT NOT NULL,
  description TEXT,
  fabric TEXT,
  color TEXT,
  price INTEGER NOT NULL,
  mrp INTEGER NOT NULL,
  images TEXT NOT NULL,        -- JSON array of image base names
  stock TEXT NOT NULL,         -- JSON {size: qty}
  tags TEXT NOT NULL,          -- JSON array: new, bestseller, trending
  popularity INTEGER DEFAULT 0,
  rating REAL DEFAULT 4.5,
  reviews INTEGER DEFAULT 0,
  flatlay INTEGER DEFAULT 0,   -- 1 when photos are flat-lay (no model)
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
  owner TEXT NOT NULL,          -- 'u:<id>' or 'g:<guest id>'
  product_id INTEGER NOT NULL REFERENCES products(id),
  size TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner, product_id, size)
);
CREATE TABLE IF NOT EXISTS wishlist (
  owner TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner, product_id)
);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT, name TEXT NOT NULL, phone TEXT NOT NULL,
  line1 TEXT NOT NULL, line2 TEXT, city TEXT NOT NULL, state TEXT NOT NULL, pincode TEXT NOT NULL,
  is_default INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  items TEXT NOT NULL,          -- JSON snapshot of purchased lines
  subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
  coupon TEXT,
  address TEXT NOT NULL,        -- JSON snapshot
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`);

// Migration: separate try-on reference image (model photo, or the mannequin view for flat-lays).
if (!db.prepare("SELECT 1 FROM pragma_table_info('products') WHERE name='tryon_image'").get()) {
  db.exec('ALTER TABLE products ADD COLUMN tryon_image TEXT');
}

// Seed / refresh the catalogue from catalog.json (idempotent; keeps stock once seeded).
function seed() {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'catalog.json'), 'utf8'));
  const upCat = db.prepare(`INSERT INTO categories (slug,name,blurb,cover,sort) VALUES (?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name, blurb=excluded.blurb, cover=excluded.cover, sort=excluded.sort`);
  catalog.categories.forEach((c, i) => upCat.run(c.slug, c.name, c.blurb, c.cover, i));

  const exists = db.prepare('SELECT id FROM products WHERE slug = ?');
  const insert = db.prepare(`INSERT INTO products
    (slug,name,category,garment,description,fabric,color,price,mrp,images,stock,tags,popularity,rating,reviews,flatlay,created_at,tryon_image)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const update = db.prepare(`UPDATE products SET name=?,category=?,garment=?,description=?,fabric=?,color=?,price=?,mrp=?,
    images=?,tags=?,popularity=?,flatlay=?,tryon_image=? WHERE slug=?`);

  const IMG_DIR = path.join(__dirname, '..', 'public', 'img', 'products');
  catalog.products.forEach((p, i) => {
    const images = p.src.map((_, n) => `${p.slug}-${n}`);
    // An approved AI mannequin view (scripts/mannequin.js) leads the gallery; the original photo stays as image 2.
    // Try-on keeps using the real model photo; flat-lays switch to their mannequin view (making them
    // try-on-able on-device).
    let tryon = images[0];
    if (fs.existsSync(path.join(IMG_DIR, `${p.slug}-mq-480.webp`))) {
      images.unshift(`${p.slug}-mq`);
      if (p.flatlay) { tryon = `${p.slug}-mq`; p = { ...p, flatlay: false }; }
    }
    if (exists.get(p.slug)) {
      update.run(p.name, p.category, p.garment, p.desc, p.fabric, p.color, p.price, p.mrp,
        JSON.stringify(images), JSON.stringify(p.tags), p.pop, p.flatlay ? 1 : 0, tryon, p.slug);
      return;
    }
    // Deterministic demo stock: a few sizes sold out so availability filters are meaningful.
    const stock = {};
    p.sizes.forEach((s, k) => { stock[s] = (p.sizes.length > 1 && (i * 7 + k * 3) % 11 === 0) ? 0 : 2 + ((i + k * 5) % 9); });
    const created = new Date(Date.now() - p.age * 86400000).toISOString();
    const rating = Math.round((4.2 + ((i * 13) % 8) / 10) * 10) / 10;
    insert.run(p.slug, p.name, p.category, p.garment, p.desc, p.fabric, p.color, p.price, p.mrp,
      JSON.stringify(images), JSON.stringify(stock), JSON.stringify(p.tags), p.pop, rating,
      12 + ((i * 37) % 140), p.flatlay ? 1 : 0, created, tryon);
  });
}
seed();

module.exports = db;
