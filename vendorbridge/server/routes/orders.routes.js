// server/routes/orders.routes.js
const router = require('express').Router();
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity, wrap } = require('../util');

router.use(authRequired);

// Vendors are scoped to their own documents
function vendorScope(req) {
  return req.user.role === 'vendor' ? { clause: ' AND vendor_id = ?', param: [req.user.vendor_id] } : { clause: '', param: [] };
}

// GET /api/orders/purchase-orders
router.get('/purchase-orders', wrap(async (req, res) => {
  const s = vendorScope(req);
  const rows = await query(
    `SELECT po.*, v.name AS vendor_name, r.code AS rfq_code, r.title AS rfq_title
     FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id
     JOIN rfqs r    ON r.id = po.rfq_id
     WHERE 1=1 ${s.clause.replace('vendor_id', 'po.vendor_id')} ORDER BY po.created_at DESC`,
    s.param
  );
  res.json(rows);
}));

// GET /api/orders/invoices
router.get('/invoices', wrap(async (req, res) => {
  const s = vendorScope(req);
  const rows = await query(
    `SELECT i.*, v.name AS vendor_name, po.code AS po_code
     FROM invoices i
     JOIN vendors v ON v.id = i.vendor_id
     JOIN purchase_orders po ON po.id = i.po_id
     WHERE 1=1 ${s.clause.replace('vendor_id', 'i.vendor_id')} ORDER BY i.created_at DESC`,
    s.param
  );
  res.json(rows);
}));

// POST /api/orders/invoices/:id/email
router.post('/invoices/:id/email', requireRole('officer', 'manager', 'admin'), wrap(async (req, res) => {
  await query("UPDATE invoices SET status = 'Emailed' WHERE id = ?", [req.params.id]);
  const [inv] = await query('SELECT i.code, v.name FROM invoices i JOIN vendors v ON v.id = i.vendor_id WHERE i.id = ?', [req.params.id]);
  if (inv) await logActivity('invoice', `Invoice <b>${inv.code}</b> emailed to ${inv.name}`, req.user.name, inv.code);
  res.json({ ok: true });
}));

// POST /api/orders/invoices/:id/pay
router.post('/invoices/:id/pay', requireRole('officer', 'manager', 'admin'), wrap(async (req, res) => {
  await query("UPDATE invoices SET status = 'Paid' WHERE id = ?", [req.params.id]);
  const [inv] = await query('SELECT code FROM invoices WHERE id = ?', [req.params.id]);
  if (inv) await logActivity('invoice', `Invoice <b>${inv.code}</b> marked as paid`, req.user.name, inv.code);
  res.json({ ok: true });
}));

module.exports = router;
