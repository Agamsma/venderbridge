// server/routes/users.routes.js — admin-only internal user management
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity, wrap } = require('../util');
const { isEmail, isStr, check } = require('../validate');
const { bcryptRounds } = require('../config');

router.use(authRequired, requireRole('admin'));

// GET /api/users — internal (non-vendor) users
router.get('/', wrap(async (req, res) => {
  const rows = await query(
    "SELECT id, name, email, role, created_at FROM users WHERE role <> 'vendor' ORDER BY created_at DESC"
  );
  res.json(rows);
}));

// POST /api/users — create an officer / manager / admin
router.post('/', wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  const err = check([
    [isStr(name, 120), 'Name is required'],
    [isEmail(email), 'A valid email is required'],
    [isStr(password) && String(password).length >= 8, 'Password must be at least 8 characters'],
    [['officer', 'manager', 'admin'].includes(role), 'Role must be officer, manager or admin'],
  ]);
  if (err) return res.status(400).json({ error: err });

  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'A user with this email already exists' });

  const hash = bcrypt.hashSync(password, bcryptRounds);
  const r = await query('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', [name, email, hash, role]);
  await logActivity('user', `User <b>${name}</b> added as ${role}`, req.user.name);
  res.status(201).json({ id: r.insertId });
}));

module.exports = router;
