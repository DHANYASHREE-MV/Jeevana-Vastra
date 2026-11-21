// Registration, login, profile and address book.
const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[6-9]\d{9}$/;
const PIN = /^\d{6}$/;

router.get('/me', (req, res) => res.json({ user: req.user }));

router.post('/register', auth.rateLimit('auth', 20, 15 * 60 * 1000), (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Please enter your name' });
  if (!EMAIL.test(email || '')) return res.status(400).json({ error: 'Please enter a valid email' });
  if (phone && !PHONE.test(phone)) return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const lower = email.toLowerCase().trim();
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(lower)) return res.status(409).json({ error: 'An account with this email already exists' });
  const { lastInsertRowid } = db.prepare('INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)')
    .run(String(name).trim(), lower, phone || null, auth.hashPassword(password));
  const userId = Number(lastInsertRowid);
  auth.mergeGuest(req.guestOwner, userId);
  auth.createSession(res, userId);
  res.json({ user: db.prepare('SELECT id,name,email,phone,created_at FROM users WHERE id=?').get(userId) });
});

router.post('/login', auth.rateLimit('auth', 20, 15 * 60 * 1000), (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase().trim());
  if (!user || !auth.verifyPassword(password || '', user.password_hash)) return res.status(401).json({ error: 'Incorrect email or password' });
  auth.mergeGuest(req.guestOwner, user.id);
  auth.createSession(res, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, created_at: user.created_at } });
});

router.post('/logout', (req, res) => { auth.destroySession(req, res); res.json({ ok: true }); });

router.patch('/me', auth.requireUser, (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Please enter your name' });
  if (phone && !PHONE.test(phone)) return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
  db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(String(name).trim(), phone || null, req.user.id);
  res.json({ user: db.prepare('SELECT id,name,email,phone,created_at FROM users WHERE id=?').get(req.user.id) });
});

router.post('/me/password', auth.requireUser, (req, res) => {
  const { current, next } = req.body || {};
  const row = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
  if (!auth.verifyPassword(current || '', row.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (!next || next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(auth.hashPassword(next), req.user.id);
  res.json({ ok: true });
});

// ---------- Addresses ----------
function validAddress(a) {
  if (!a.name || !a.line1 || !a.city || !a.state) return 'Please fill in all required address fields';
  if (!PHONE.test(a.phone || '')) return 'Please enter a valid 10-digit mobile number';
  if (!PIN.test(a.pincode || '')) return 'Please enter a valid 6-digit PIN code';
  return null;
}
const listAddresses = (uid) => db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC').all(uid);

router.get('/addresses', auth.requireUser, (req, res) => res.json(listAddresses(req.user.id)));

router.post('/addresses', auth.requireUser, (req, res) => {
  const a = req.body || {};
  const err = validAddress(a);
  if (err) return res.status(400).json({ error: err });
  const first = !db.prepare('SELECT 1 FROM addresses WHERE user_id=?').get(req.user.id);
  if (a.is_default && !first) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  const { lastInsertRowid } = db.prepare(`INSERT INTO addresses (user_id,label,name,phone,line1,line2,city,state,pincode,is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, a.label || 'Home', a.name, a.phone, a.line1, a.line2 || '', a.city, a.state, a.pincode, first || a.is_default ? 1 : 0);
  res.json({ id: Number(lastInsertRowid), addresses: listAddresses(req.user.id) });
});

router.put('/addresses/:id', auth.requireUser, (req, res) => {
  const a = req.body || {};
  const err = validAddress(a);
  if (err) return res.status(400).json({ error: err });
  if (a.is_default) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  db.prepare(`UPDATE addresses SET label=?,name=?,phone=?,line1=?,line2=?,city=?,state=?,pincode=?,is_default=MAX(is_default,?)
    WHERE id=? AND user_id=?`).run(a.label || 'Home', a.name, a.phone, a.line1, a.line2 || '', a.city, a.state, a.pincode, a.is_default ? 1 : 0, Number(req.params.id), req.user.id);
  res.json(listAddresses(req.user.id));
});

router.delete('/addresses/:id', auth.requireUser, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(Number(req.params.id), req.user.id);
  const rest = listAddresses(req.user.id);
  if (rest.length && !rest.some((a) => a.is_default)) db.prepare('UPDATE addresses SET is_default=1 WHERE id=?').run(rest[0].id);
  res.json(listAddresses(req.user.id));
});

module.exports = router;
