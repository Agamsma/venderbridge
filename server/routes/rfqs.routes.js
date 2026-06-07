// server/routes/rfqs.routes.js
const router = require('express').Router();
const { query, transaction } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity, tmpCode, wrap } = require('../util');
const { isStr, isNum, check } = require('../validate');

router.use(authRequired);

// GET /api/rfqs   (vendors only see RFQs they are invited to)
router.get('/', wrap(async (req, res) => {
  let sql, params = [];
  if (req.user.role === 'vendor') {
    sql = `SELECT r.* FROM rfqs r JOIN rfq_vendors rv ON rv.rfq_id = r.id
           WHERE rv.vendor_id = ? ORDER BY r.created_at DESC`;
    params = [req.user.vendor_id];
  } else {
    sql = 'SELECT * FROM rfqs ORDER BY created_at DESC';
  }
  res.json(await query(sql, params));
}));

// POST /api/rfqs   (officer/admin create an RFQ and invite vendors)
router.post('/', requireRole('officer', 'admin'), wrap(async (req, res) => {
  const { title, details = '', quantity = 1, unit = 'units', deadline = null, vendorIds = [] } = req.body;
  const ids = Array.isArray(vendorIds) ? vendorIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const err = check([
    [isStr(title, 200), 'RFQ title is required'],
    [isNum(quantity, 1, 1e9), 'Quantity must be a positive number'],
    [isStr(unit, 40), 'Unit is required'],
    [ids.length > 0, 'Invite at least one valid vendor'],
  ]);
  if (err) return res.status(400).json({ error: err });

  const result = await transaction(async (conn) => {
    const tmp = tmpCode();
    const [r] = await conn.execute(
      'INSERT INTO rfqs (code, title, details, quantity, unit, deadline, status, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [tmp, title.trim(), String(details).slice(0, 5000), quantity, unit.trim(), deadline || null, 'Open', req.user.id]
    );
    const code = 'RFQ-' + (2040 + r.insertId);            // derived from id → collision-free
    await conn.execute('UPDATE rfqs SET code = ? WHERE id = ?', [code, r.insertId]);
    for (const vid of ids)
      await conn.execute('INSERT IGNORE INTO rfq_vendors (rfq_id, vendor_id) VALUES (?,?)', [r.insertId, vid]);
    return { id: r.insertId, code };
  });

  await logActivity('rfq', `<b>${result.code}</b> · ${title.trim()} created and sent to ${ids.length} vendor(s)`, req.user.name, result.code);
  res.status(201).json(result);
}));

// GET /api/rfqs/:id  (detail + invited vendors + quotations)
router.get('/:id', wrap(async (req, res) => {
  const [rfq] = await query('SELECT * FROM rfqs WHERE id = ?', [req.params.id]);
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  const invited = await query('SELECT vendor_id FROM rfq_vendors WHERE rfq_id = ?', [req.params.id]);
  const quotes = await query(
    `SELECT q.*, v.name AS vendor_name, v.rating FROM quotations q
     JOIN vendors v ON v.id = q.vendor_id WHERE q.rfq_id = ? ORDER BY q.unit_price ASC`,
    [req.params.id]
  );
  res.json({ ...rfq, vendorIds: invited.map((i) => i.vendor_id), quotes });
}));

// POST /api/rfqs/:id/quotations   (vendor submits or updates its quote — upsert)
router.post('/:id/quotations', requireRole('vendor'), wrap(async (req, res) => {
  const { unitPrice, deliveryDays, notes = '' } = req.body;
  const err = check([
    [isNum(unitPrice, 0.01, 1e12), 'A valid unit price is required'],
    [isNum(deliveryDays, 1, 3650), 'Delivery time must be between 1 and 3650 days'],
  ]);
  if (err) return res.status(400).json({ error: err });

  const [rfq] = await query('SELECT code, status FROM rfqs WHERE id = ?', [req.params.id]);
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  if (rfq.status !== 'Open') return res.status(409).json({ error: 'This RFQ is no longer accepting quotations' });

  const invited = await query('SELECT 1 FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', [req.params.id, req.user.vendor_id]);
  if (!invited.length) return res.status(403).json({ error: 'You were not invited to this RFQ' });

  await query(
    `INSERT INTO quotations (rfq_id, vendor_id, unit_price, delivery_days, notes) VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price), delivery_days = VALUES(delivery_days), notes = VALUES(notes)`,
    [req.params.id, req.user.vendor_id, Number(unitPrice), Number(deliveryDays), String(notes).slice(0, 1000)]
  );
  await logActivity('quote', `${req.user.name} submitted a quotation for <b>${rfq.code}</b>`, req.user.name, rfq.code);
  res.status(201).json({ ok: true });
}));

// POST /api/rfqs/:id/send-approval   (officer recommends a quote → manager review)
router.post('/:id/send-approval', requireRole('officer', 'admin'), wrap(async (req, res) => {
  const { quotationId, note = '' } = req.body;
  if (!isNum(quotationId, 1)) return res.status(400).json({ error: 'Select a recommended quotation' });

  const [rfq] = await query('SELECT code, status FROM rfqs WHERE id = ?', [req.params.id]);
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  if (rfq.status !== 'Open') return res.status(409).json({ error: 'This RFQ is not open for approval submission' });

  const [q] = await query('SELECT id FROM quotations WHERE id = ? AND rfq_id = ?', [quotationId, req.params.id]);
  if (!q) return res.status(400).json({ error: 'That quotation does not belong to this RFQ' });

  await transaction(async (conn) => {
    await conn.execute(
      'INSERT INTO approvals (rfq_id, quotation_id, state, remark, requested_by) VALUES (?,?,?,?,?)',
      [req.params.id, quotationId, 'Under Review', String(note).slice(0, 1000), req.user.id]
    );
    await conn.execute("UPDATE rfqs SET status = 'In Approval' WHERE id = ?", [req.params.id]);
    await conn.execute("UPDATE quotations SET status = 'Shortlisted' WHERE id = ?", [quotationId]);
  });

  await logActivity('approve', `<b>${rfq.code}</b> sent for approval`, req.user.name, rfq.code);
  res.json({ ok: true });
}));

module.exports = router;
