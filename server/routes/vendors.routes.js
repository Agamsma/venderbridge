// server/routes/vendors.routes.js
const router = require('express').Router();
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity, wrap } = require('../util');

router.use(authRequired);

// GET /api/vendors?status=&q=
router.get('/', wrap(async (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM vendors WHERE 1=1';
  const params = [];
  if (status && status !== 'All') { sql += ' AND status = ?'; params.push(status); }
  if (q) { sql += ' AND (name LIKE ? OR category LIKE ? OR gst LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY name ASC';
  res.json(await query(sql, params));
}));

// POST /api/vendors   (officer/admin)
router.post('/', requireRole('officer', 'admin', 'manager'), wrap(async (req, res) => {
  const { name, category = 'General', gst = null, email = null, phone = null, status = 'Pending' } = req.body;
  if (!name) return res.status(400).json({ error: 'Vendor name is required' });
  const r = await query(
    'INSERT INTO vendors (name, category, gst, email, phone, status) VALUES (?,?,?,?,?,?)',
    [name, category, gst, email, phone, status]
  );
  await logActivity('vendors', `New vendor <b>${name}</b> registered`, req.user.name);
  res.status(201).json({ id: r.insertId });
}));

// PATCH /api/vendors/:id  (status / rating updates)
router.patch('/:id', requireRole('officer', 'admin', 'manager'), wrap(async (req, res) => {
  const fields = [], params = [];
  for (const k of ['name', 'category', 'gst', 'email', 'phone', 'status', 'rating']) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  await query(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
}));

module.exports = router;
