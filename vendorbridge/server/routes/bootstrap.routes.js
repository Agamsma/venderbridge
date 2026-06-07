// server/routes/bootstrap.routes.js
// One aggregate read that hydrates the front-end store after login.
const router = require('express').Router();
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');
const { wrap } = require('../util');

const S = (v) => (v === null || v === undefined ? null : String(v));

router.get('/', authRequired, wrap(async (req, res) => {
  const role = req.user.role;
  const vid = req.user.vendor_id;
  const isVendor = role === 'vendor';

  // ---- vendors (always all, for name/lookup resolution) ----
  const vendors = (await query('SELECT * FROM vendors ORDER BY name')).map(v => ({
    id: S(v.id), name: v.name, cat: v.category, gst: v.gst, email: v.email,
    phone: v.phone, status: v.status, rating: Number(v.rating),
  }));

  // ---- rfqs (vendor sees only invited) ----
  const rfqRows = isVendor
    ? await query(`SELECT r.* FROM rfqs r JOIN rfq_vendors rv ON rv.rfq_id = r.id
                   WHERE rv.vendor_id = ? ORDER BY r.created_at DESC`, [vid])
    : await query('SELECT * FROM rfqs ORDER BY created_at DESC');

  const invites = await query('SELECT rfq_id, vendor_id FROM rfq_vendors');
  const inviteMap = {};
  invites.forEach(i => { (inviteMap[i.rfq_id] ||= []).push(S(i.vendor_id)); });

  const rfqs = rfqRows.map(r => ({
    id: S(r.id), code: r.code, title: r.title, details: r.details,
    qty: r.quantity, unit: r.unit, deadline: r.deadline, status: r.status,
    vendors: inviteMap[r.id] || [], createdAt: r.created_at,
  }));

  // ---- quotations (vendor sees only own) ----
  const quoteRows = isVendor
    ? await query('SELECT * FROM quotations WHERE vendor_id = ?', [vid])
    : await query('SELECT * FROM quotations');
  const quotes = quoteRows.map(q => ({
    id: S(q.id), rfqId: S(q.rfq_id), vendorId: S(q.vendor_id),
    price: Number(q.unit_price), days: q.delivery_days, notes: q.notes,
    status: q.status, at: q.created_at,
  }));

  // ---- approvals (hidden from vendors) ----
  let approvals = [];
  if (!isVendor) {
    const aRows = await query(
      `SELECT a.*, u.name AS decider FROM approvals a LEFT JOIN users u ON u.id = a.decided_by
       ORDER BY a.created_at DESC`
    );
    approvals = aRows.map(a => ({
      id: S(a.id), rfqId: S(a.rfq_id), quoteId: S(a.quotation_id),
      state: a.state, remark: a.remark, by: a.decider || '',
      at: a.decided_at || a.created_at,
    }));
  }

  // ---- purchase orders + invoices (vendor sees own) ----
  const poRows = isVendor
    ? await query('SELECT * FROM purchase_orders WHERE vendor_id = ? ORDER BY created_at DESC', [vid])
    : await query('SELECT * FROM purchase_orders ORDER BY created_at DESC');
  const pos = poRows.map(p => ({
    id: S(p.id), code: p.code, rfqId: S(p.rfq_id), quoteId: S(p.quotation_id),
    vendorId: S(p.vendor_id), qty: p.quantity, price: Number(p.unit_price),
    status: p.status, at: p.created_at,
  }));

  const invRows = isVendor
    ? await query('SELECT * FROM invoices WHERE vendor_id = ? ORDER BY created_at DESC', [vid])
    : await query('SELECT * FROM invoices ORDER BY created_at DESC');
  const invoices = invRows.map(i => ({
    id: S(i.id), code: i.code, poId: S(i.po_id), vendorId: S(i.vendor_id),
    subtotal: Number(i.subtotal), taxRate: Number(i.tax_rate), status: i.status, at: i.created_at,
  }));

  // ---- activity ----
  const actRows = await query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50');
  const activity = actRows.map(a => ({ id: S(a.id), type: a.type, text: a.message, actor: a.actor, at: a.created_at }));

  // ---- internal users (admin only, for User Management) ----
  let users = [];
  if (role === 'admin') {
    const ur = await query("SELECT id, name, email, role, created_at FROM users WHERE role <> 'vendor' ORDER BY created_at DESC");
    users = ur.map(u => ({ id: S(u.id), name: u.name, email: u.email, role: u.role, at: u.created_at }));
  }

  res.json({
    me: { role, name: req.user.name, vendorId: S(vid) },
    vendors, rfqs, quotes, approvals, pos, invoices, activity, users,
  });
}));

module.exports = router;
