// server/routes/auth.routes.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const { logActivity, wrap } = require('../util');
const { isEmail, isStr, check } = require('../validate');
const { bcryptRounds } = require('../config');

// POST /api/auth/register  — PUBLIC self-service signup.
// Security: public registration ALWAYS creates a 'vendor' account.
// Internal roles (officer/manager/admin) are created by an admin via /api/users.
router.post('/register', wrap(async (req, res) => {
  const { name, email, password, category } = req.body;
  const err = check([
    [isStr(name, 120), 'Please provide your company / contact name'],
    [isEmail(email), 'A valid email address is required'],
    [isStr(password) && String(password).length >= 8, 'Password must be at least 8 characters'],
  ]);
  if (err) return res.status(400).json({ error: err });

  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, bcryptRounds);

  const user = await transaction(async (conn) => {
    const [v] = await conn.execute(
      'INSERT INTO vendors (name, category, email, status) VALUES (?,?,?,?)',
      [name, isStr(category, 80) ? category : 'General', email, 'Pending']
    );
    const [u] = await conn.execute(
      'INSERT INTO users (name, email, password_hash, role, vendor_id) VALUES (?,?,?,?,?)',
      [name, email, hash, 'vendor', v.insertId]
    );
    return { id: u.insertId, name, email, role: 'vendor', vendor_id: v.insertId };
  });

  await logActivity('vendors', `New vendor <b>${name}</b> registered an account`, name);
  const token = signToken(user);
  res.status(201).json({ token, user: { id: user.id, name, email, role: 'vendor', vendorId: user.vendor_id } });
}));

// POST /api/auth/login
router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!isEmail(email) || !isStr(password))
    return res.status(400).json({ error: 'Email and password are required' });

  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, vendorId: user.vendor_id } });
}));

// GET /api/auth/me
router.get('/me', authRequired, wrap(async (req, res) => {
  const rows = await query('SELECT id, name, email, role, vendor_id FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, vendorId: u.vendor_id });
}));

module.exports = router;
