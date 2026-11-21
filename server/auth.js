// Password hashing (scrypt), cookie sessions, guest identity and request helpers.
const crypto = require('node:crypto');
const db = require('./db');

const SESSION_DAYS = 30;
const isProd = process.env.NODE_ENV === 'production';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setCookie(res, name, value, maxAgeSec) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (isProd) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .run(token, userId, Date.now() + SESSION_DAYS * 86400000);
  setCookie(res, 'jv_session', token, SESSION_DAYS * 86400);
}

function destroySession(req, res) {
  const token = parseCookies(req).jv_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  setCookie(res, 'jv_session', '', 0);
}

// Attaches req.user (or null) and req.owner (cart/wishlist owner key) to every request.
function identify(req, res, next) {
  const cookies = parseCookies(req);
  req.user = null;
  if (cookies.jv_session) {
    const row = db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.created_at, s.expires_at FROM sessions s
      JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(cookies.jv_session);
    if (row && row.expires_at > Date.now()) {
      delete row.expires_at;
      req.user = { ...row };
    }
  }
  let guest = cookies.jv_guest;
  if (!guest || !/^[a-f0-9]{32}$/.test(guest)) {
    guest = crypto.randomBytes(16).toString('hex');
    setCookie(res, 'jv_guest', guest, 365 * 86400);
  }
  req.guestOwner = `g:${guest}`;
  req.owner = req.user ? `u:${req.user.id}` : req.guestOwner;
  next();
}

// Move a guest's cart and wishlist into the user's account after login/registration.
function mergeGuest(guestOwner, userId) {
  const owner = `u:${userId}`;
  const items = db.prepare('SELECT product_id, size, qty FROM cart_items WHERE owner = ?').all(guestOwner);
  const upsert = db.prepare(`INSERT INTO cart_items (owner, product_id, size, qty) VALUES (?,?,?,?)
    ON CONFLICT(owner, product_id, size) DO UPDATE SET qty = MIN(10, qty + excluded.qty)`);
  items.forEach((i) => upsert.run(owner, i.product_id, i.size, i.qty));
  db.prepare('INSERT OR IGNORE INTO wishlist (owner, product_id) SELECT ?, product_id FROM wishlist WHERE owner = ?')
    .run(owner, guestOwner);
  db.prepare('DELETE FROM cart_items WHERE owner = ?').run(guestOwner);
  db.prepare('DELETE FROM wishlist WHERE owner = ?').run(guestOwner);
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

// Tiny in-memory rate limiter (per IP + bucket).
const hits = new Map();
function rateLimit(bucket, max, windowMs) {
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const rec = hits.get(key) || { n: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.n = 0; rec.reset = now + windowMs; }
    rec.n += 1;
    hits.set(key, rec);
    if (rec.n > max) return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
    next();
  };
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, identify, mergeGuest, requireUser, rateLimit };
